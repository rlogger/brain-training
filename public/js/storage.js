window.BT = window.BT || {};

window.BT.Storage = {
  _apiBase: '/api',
  _useServer: false,
  _cache: { sessions: null, settings: null },

  async init() {
    try {
      const res = await fetch(this._apiBase + '/settings', { method: 'GET' });
      if (res.ok) {
        this._useServer = true;
        const serverSettings = await res.json();
        for (const [k, v] of Object.entries(serverSettings)) {
          this._cache.settings = this._cache.settings || {};
          this._cache.settings[k] = v;
        }
        const sessRes = await fetch(this._apiBase + '/sessions?limit=500');
        if (sessRes.ok) this._cache.sessions = await sessRes.json();
        await this._migrateIfNeeded();
      }
    } catch { /* no server, localStorage only */ }
  },

  async _migrateIfNeeded() {
    if (this._getLocal('bt_migrated')) return;
    const localSessions = this._getLocal('bt_sessions', []);
    if (localSessions.length === 0) {
      this._setLocal('bt_migrated', true);
      return;
    }
    try {
      const res = await fetch(this._apiBase + '/sessions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: localSessions }),
      });
      if (res.ok) {
        this._setLocal('bt_migrated', true);
        const sessRes = await fetch(this._apiBase + '/sessions?limit=500');
        if (sessRes.ok) this._cache.sessions = await sessRes.json();
      }
    } catch { /* migration failed, will retry next load */ }

    const settingsKeys = ['bt_nback_settings', 'bt_cwm_settings', 'bt_dark_mode', 'bt_last_view'];
    for (const key of settingsKeys) {
      const val = this._getLocal(key);
      if (val !== undefined && val !== null) {
        fetch(this._apiBase + '/settings/' + key, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(val),
        }).catch(() => {});
      }
    }
  },

  _getLocal(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  _setLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  get(key, defaultValue) {
    if (this._useServer && this._cache.settings && key in this._cache.settings) {
      return this._cache.settings[key];
    }
    return this._getLocal(key, defaultValue);
  },

  set(key, value) {
    this._setLocal(key, value);
    if (this._useServer) {
      if (this._cache.settings) this._cache.settings[key] = value;
      fetch(this._apiBase + '/settings/' + key, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      }).catch(() => {});
    }
  },

  addSession(record) {
    record.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    record.timestamp = Date.now();

    const sessions = this._getLocal('bt_sessions', []);
    sessions.push(record);
    if (sessions.length > 500) sessions.splice(0, sessions.length - 500);
    this._setLocal('bt_sessions', sessions);

    if (this._useServer) {
      if (this._cache.sessions) this._cache.sessions.unshift(record);
      fetch(this._apiBase + '/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {});
    }

    return record;
  },

  getSessions(exerciseType) {
    const all = (this._useServer && this._cache.sessions) ? this._cache.sessions : this._getLocal('bt_sessions', []);
    if (!exerciseType) return all;
    return all.filter(s => s.exercise === exerciseType);
  },

  clearSessions() {
    this._setLocal('bt_sessions', []);
    if (this._useServer) {
      this._cache.sessions = [];
      fetch(this._apiBase + '/sessions?confirm=true', { method: 'DELETE' }).catch(() => {});
    }
  }
};
