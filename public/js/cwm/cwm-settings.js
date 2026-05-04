window.BT = window.BT || {};

window.BT.CWMSettings = {
  _key: 'bt_cwm_settings',

  load() {
    return { ...window.BT.CWMEngine.defaultSettings(), ...window.BT.Storage.get(this._key, {}) };
  },

  save(settings) {
    window.BT.Storage.set(this._key, settings);
  },

  renderPanel(container, settings, onChange) {
    const totalDecisions = settings.level * settings.decisionsPerRound;
    const estimatedTime = settings.level * (settings.decisionsPerRound * (settings.trialTime / 1000 + 1) + 2) + 10;
    const mins = Math.floor(estimatedTime / 60);
    const secs = Math.round(estimatedTime % 60);
    const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    container.innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">Next Set</div>
        <div class="panel-row"><span class="label">Level</span><span class="value">${settings.level}</span></div>
        <div class="panel-row"><span class="label">Number of trials</span><span class="value">${totalDecisions}</span></div>
        <div class="panel-row"><span class="label">Trial time</span><span class="value">${settings.trialTime / 1000}s</span></div>
        <div class="panel-row"><span class="label">Duration</span><span class="value">~${durStr}</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Today</div>
        <div id="cwm-today-sets"></div>
      </div>
      <details class="panel-section panel-disclosure">
        <summary class="panel-section-title">Adjust</summary>
        <div class="setting-row">
          <label title="How long each decision is shown.">Decision pace</label>
          <input type="number" class="input-field input-sm" id="cwm-trial-time" value="${settings.trialTime}" min="1000" max="10000" step="500">
        </div>
        <div class="setting-row">
          <label title="Decisions before each item to remember.">Decisions per round</label>
          <input type="number" class="input-field input-sm" id="cwm-decisions" value="${settings.decisionsPerRound}" min="2" max="8">
        </div>
        <div class="setting-row">
          <label title="Score needed to move up a level.">Level-up threshold</label>
          <input type="number" class="input-field input-sm" id="cwm-advance" value="${settings.advanceThreshold}" min="50" max="100">
        </div>
        <div class="setting-row">
          <label title="Score below which the level drops.">Level-down threshold</label>
          <input type="number" class="input-field input-sm" id="cwm-fallback" value="${settings.fallbackThreshold}" min="20" max="80">
        </div>
        <div class="setting-row">
          <label title="Briefly show ✓ or ✗ after each decision.">Show feedback</label>
          <input type="checkbox" class="toggle" id="cwm-feedback" ${settings.feedback ? 'checked' : ''}>
        </div>
        <div class="setting-row">
          <label title="Lets the level rise or fall based on your performance.">Auto-adjust level</label>
          <input type="checkbox" class="toggle" id="cwm-adaptive" ${settings.adaptive ? 'checked' : ''}>
        </div>
        <div class="setting-row">
          <label>Key for "yes"</label>
          <input type="text" class="input-field input-sm" id="cwm-key-yes" value="${settings.keyYes}" maxlength="1">
        </div>
        <div class="setting-row">
          <label>Key for "no"</label>
          <input type="text" class="input-field input-sm" id="cwm-key-no" value="${settings.keyNo}" maxlength="1">
        </div>
      </details>
    `;

    const numFields = [
      ['cwm-trial-time', 'trialTime'],
      ['cwm-decisions', 'decisionsPerRound'],
      ['cwm-advance', 'advanceThreshold'],
      ['cwm-fallback', 'fallbackThreshold'],
    ];
    numFields.forEach(([id, key]) => {
      container.querySelector('#' + id).addEventListener('change', (e) => {
        settings[key] = parseInt(e.target.value, 10);
        this.save(settings);
        if (onChange) onChange(settings);
      });
    });

    container.querySelector('#cwm-feedback').addEventListener('change', (e) => {
      settings.feedback = e.target.checked;
      this.save(settings);
    });

    container.querySelector('#cwm-adaptive').addEventListener('change', (e) => {
      settings.adaptive = e.target.checked;
      this.save(settings);
    });

    ['cwm-key-yes', 'cwm-key-no'].forEach((id, i) => {
      container.querySelector('#' + id).addEventListener('change', (e) => {
        const key = i === 0 ? 'keyYes' : 'keyNo';
        settings[key] = e.target.value.toUpperCase() || (i === 0 ? 'A' : 'L');
        e.target.value = settings[key];
        this.save(settings);
      });
    });

    this.renderTodaySets(container.querySelector('#cwm-today-sets'));
  },

  renderTodaySets(container) {
    const sessions = window.BT.Storage.getSessions('cwm');
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(s => new Date(s.timestamp).toDateString() === today);

    if (!todaySessions.length) {
      container.innerHTML = '<div class="panel-empty">First set of the day.</div>';
      return;
    }

    container.innerHTML = todaySessions.map(s => `
      <div class="panel-row">
        <span class="label">${s.cwmType[0].toUpperCase()}${s.cwmType.slice(1)} · ${s.cwmLevel}</span>
        <span class="value">${Math.round((s.combined || 0) * 100)}%</span>
      </div>
    `).join('');
  }
};
