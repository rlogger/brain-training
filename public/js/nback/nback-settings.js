window.BT = window.BT || {};

window.BT.NBackSettings = {
  _key: 'bt_nback_settings',

  load() {
    return { ...window.BT.NBackEngine.defaultSettings(), ...window.BT.Storage.get(this._key, {}) };
  },

  save(settings) {
    window.BT.Storage.set(this._key, settings);
  },

  renderPanel(container, settings, onChange) {
    container.innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">This set<span class="ref">REG /set</span></div>
        <div class="measure"><span class="tick-l"></span><span class="px">280px</span><span class="tick-r"></span></div>
        <div class="panel-row"><span class="label">N-back depth</span><span class="value" id="nb-info-level">${settings.n}</span></div>
        <div class="panel-row"><span class="label">Trials</span><span class="value" id="nb-info-trials">${settings.trialCount + settings.n}</span></div>
        <div class="panel-row"><span class="label">Total time</span><span class="value" id="nb-info-duration">${Math.round((settings.trialCount + settings.n) * (settings.trialTime + settings.isi) / 1000)} s</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Today<span class="ref">REG /day</span></div>
        <div id="nb-today-sets" class="today-sets"></div>
      </div>
      <details class="panel-section panel-disclosure">
        <summary class="panel-section-title">Adjust<span class="ref">REG /cfg</span></summary>
        <div class="setting-row">
          <label title="Speeds up or slows down the pace. Lower = harder.">Stimulus pace</label>
          <input type="number" class="input-field input-sm" id="nb-trial-time" value="${settings.trialTime}" min="500" max="10000" step="100">
        </div>
        <div class="setting-row">
          <label title="Quiet gap between stimuli. Lower = harder.">Gap between</label>
          <input type="number" class="input-field input-sm" id="nb-isi" value="${settings.isi}" min="100" max="3000" step="100">
        </div>
        <div class="setting-row">
          <label title="How many stimuli to present in one set.">Stimulus count</label>
          <input type="number" class="input-field input-sm" id="nb-trial-count" value="${settings.trialCount}" min="5" max="50">
        </div>
        <div class="setting-row">
          <label title="Roughly what fraction of stimuli will be matches. 25% is standard.">Target matches</label>
          <input type="number" class="input-field input-sm" id="nb-match-pct" value="${settings.matchPct}" min="10" max="50">
        </div>
        <div class="setting-row">
          <label title="Lets the level rise or fall based on your performance.">Auto-adjust level</label>
          <input type="checkbox" class="toggle" id="nb-adaptive" ${settings.adaptive ? 'checked' : ''}>
        </div>
      </details>
    `;

    const ids = ['nb-trial-time','nb-isi','nb-trial-count','nb-match-pct'];
    const keys = ['trialTime','isi','trialCount','matchPct'];
    ids.forEach((id, i) => {
      const el = container.querySelector('#' + id);
      el.addEventListener('change', () => {
        settings[keys[i]] = parseInt(el.value, 10);
        this.save(settings);
        if (onChange) onChange(settings);
      });
    });

    container.querySelector('#nb-adaptive').addEventListener('change', (e) => {
      settings.adaptive = e.target.checked;
      this.save(settings);
      if (onChange) onChange(settings);
    });

    this.renderTodaySets(container.querySelector('#nb-today-sets'));
  },

  renderTodaySets(container) {
    const sessions = window.BT.Storage.getSessions('nback');
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(s => new Date(s.timestamp).toDateString() === today);

    if (!todaySessions.length) {
      container.innerHTML = '<div class="panel-empty">First set of the day.</div>';
      return;
    }

    container.innerHTML = todaySessions.map(s => `
      <div class="panel-row">
        <span class="label">N${s.nbackLevel} · ${s.modalities.map(m => m[0].toUpperCase()).join('')}</span>
        <span class="value">${Math.round(s.overallAccuracy * 100)}%</span>
      </div>
    `).join('');
  },

  updateInfo(container, settings) {
    const el = (id) => container.querySelector('#' + id);
    if (el('nb-info-level')) el('nb-info-level').textContent = settings.n;
    if (el('nb-info-trials')) el('nb-info-trials').textContent = settings.trialCount + settings.n;
    if (el('nb-info-duration')) el('nb-info-duration').textContent = Math.round((settings.trialCount + settings.n) * (settings.trialTime + settings.isi) / 1000) + ' s';
  }
};
