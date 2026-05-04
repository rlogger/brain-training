window.BT = window.BT || {};

window.BT.Storage = {
  get(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  addSession(record) {
    const sessions = this.get('bt_sessions', []);
    record.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    record.timestamp = Date.now();
    sessions.push(record);
    if (sessions.length > 500) sessions.splice(0, sessions.length - 500);
    this.set('bt_sessions', sessions);
    return record;
  },

  getSessions(exerciseType) {
    const all = this.get('bt_sessions', []);
    if (!exerciseType) return all;
    return all.filter(s => s.exercise === exerciseType);
  },

  clearSessions() {
    this.set('bt_sessions', []);
  }
};
