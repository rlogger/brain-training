window.BT = window.BT || {};

const MOD_KEYS = { position: 'A', audio: 'S', color: 'D', shape: 'F', number: 'G' };
const MOD_LABELS = { position: 'Position', audio: 'Audio', color: 'Color', shape: 'Shape', number: 'Number' };
const TYPE_CODES = { position: 'P', audio: 'A', color: 'C', shape: 'S', number: 'N' };

function getTypeName(modalities) {
  const count = modalities.length;
  const names = { 1: 'Single', 2: 'Dual', 3: 'Triple', 4: 'Quad', 5: 'Penta' };
  const code = modalities.map(m => TYPE_CODES[m]).join('');
  return `${names[count] || count}(${code})`;
}

function drawShape(cell, shape, color) {
  cell.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('cell-shape');
  const fill = color || 'currentColor';

  const paths = {
    circle: `<circle cx="50" cy="50" r="40" fill="${fill}"/>`,
    square: `<rect x="15" y="15" width="70" height="70" fill="${fill}"/>`,
    triangle: `<polygon points="50,10 90,85 10,85" fill="${fill}"/>`,
    diamond: `<polygon points="50,5 95,50 50,95 5,50" fill="${fill}"/>`,
    pentagon: `<polygon points="50,5 97,38 79,92 21,92 3,38" fill="${fill}"/>`,
    hexagon: `<polygon points="50,3 93,25 93,75 50,97 7,75 7,25" fill="${fill}"/>`,
    star: `<polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill="${fill}"/>`,
    cross: `<polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35" fill="${fill}"/>`,
  };

  svg.innerHTML = paths[shape] || paths.circle;
  cell.appendChild(svg);
}

const COORDS = ['0,0','1,0','2,0','0,1','1,1','2,1','0,2','1,2','2,2'];

window.BT.NBackUI = {
  _settings: null,
  _sequence: [],
  _responses: {},
  _currentIndex: -1,
  _running: false,
  _timer: null,
  _phase: 'idle',
  _cellStats: null,

  init() {
    this._settings = window.BT.NBackSettings.load();
    this._renderView();
    this._bindKeys();
  },

  _renderView() {
    const view = document.getElementById('view-nback');
    const arena = view.querySelector('.exercise-arena');
    const panel = view.querySelector('.exercise-panel');
    const pad = (n, w = 2) => String(n).padStart(w, '0');

    this._cellStats = Array.from({length: 9}, () => ({ shown: 0, hits: 0 }));

    arena.innerHTML = `
      <div class="nback-stage">
        <div class="nback-trial-info" id="nb-trial-counter" style="display:none">
          <span class="label">TRIAL</span>
          <span id="nb-trial-num">00 / 00</span>
          <div class="progress-bar"><div id="nb-trial-bar-fill"></div></div>
        </div>

        <div class="nback-play-row">
          <div class="nback-depth">
            <span class="label">N-Back Depth</span>
            <div class="nback-depth-control">
              <button class="nback-depth-btn" id="nb-n-down" aria-label="Decrease level">−</button>
              <div class="nback-depth-value" id="nb-hero-n">${this._settings.n}</div>
              <button class="nback-depth-btn" id="nb-n-up" aria-label="Increase level">+</button>
            </div>
            <button class="header-link" id="nb-hero-type">${getTypeName(this._settings.modalities)}</button>
          </div>

          <div class="nback-grid-wrap">
            <div class="grid-frame">
              <span class="corner tl"></span><span class="corner tr"></span>
              <span class="corner bl"></span><span class="corner br"></span>
              <span class="axis-label x">X · POS</span>
              <span class="axis-label y">Y · POS</span>
            </div>
            <div class="nback-grid" id="nb-grid">
              ${Array(9).fill(0).map((_, i) => `
                <div class="nback-cell" data-cell="${i}">
                  <span class="pin">${COORDS[i]}</span>
                  <span class="idx">${pad(i,2)}</span>
                  <span class="hit">HIT <em>0/0</em></span>
                  <span class="hz">−</span>
                </div>
              `).join('')}
            </div>
            <div class="nback-feedback" id="nb-feedback"></div>
          </div>

          <div class="nback-match-buttons" id="nb-match-btns"></div>
        </div>

        <div class="nback-actions" id="nb-start-area">
          <button class="btn btn-primary btn-lg" id="nb-start-btn">▸ BEGIN SET</button>
          <span class="hint">Press <span class="kbd">Space</span> to start · <span class="kbd">?</span> for help</span>
        </div>
      </div>
      <div id="nb-results" style="display:none"></div>
    `;

    this._renderMatchButtons();

    window.BT.NBackSettings.renderPanel(panel, this._settings, (s) => {
      this._settings = s;
      this._updateHeader();
    });

    this._updateHeader();
    this._bindUIEvents();
  },

  _updateHeader() {
    const view = document.getElementById('view-nback');
    const h1 = view.querySelector('.exercise-header h1');
    if (h1) h1.textContent = 'N-Back Training';
    const heroN = document.getElementById('nb-hero-n');
    if (heroN) heroN.textContent = this._settings.n;
    const heroType = document.getElementById('nb-hero-type');
    if (heroType) heroType.textContent = getTypeName(this._settings.modalities);
    window.BT.NBackSettings.updateInfo(document.querySelector('#view-nback .exercise-panel'), this._settings);
  },

  _bindUIEvents() {
    document.getElementById('nb-start-btn').addEventListener('click', () => this.startSession());
    document.getElementById('nb-hero-type').addEventListener('click', () => this._showModalityModal());
    document.getElementById('nb-n-up').addEventListener('click', () => this._stepN(1));
    document.getElementById('nb-n-down').addEventListener('click', () => this._stepN(-1));
  },

  _stepN(delta) {
    if (this._running) return;
    const next = Math.max(1, Math.min(9, this._settings.n + delta));
    if (next === this._settings.n) return;
    this._settings.n = next;
    window.BT.NBackSettings.save(this._settings);
    this._updateHeader();
  },

  _showModalityModal() {
    const overlay = document.getElementById('modality-modal-overlay');
    const body = overlay.querySelector('.modal-body');
    const allMods = ['audio', 'position', 'color', 'shape', 'number'];

    body.innerHTML = allMods.map(m => `
      <div class="checkbox-row">
        <input type="checkbox" id="mod-${m}" ${this._settings.modalities.includes(m) ? 'checked' : ''}>
        <label for="mod-${m}" class="mod-name">${MOD_LABELS[m]}</label>
      </div>
    `).join('') + `
      <div class="selected-type">Selected type · <strong id="modal-type-name">${getTypeName(this._settings.modalities)}</strong></div>
    `;

    const saveBtn = overlay.querySelector('.modal-save-btn');

    const updateState = () => {
      const sel = allMods.filter(m => body.querySelector('#mod-' + m).checked);
      const nameEl = document.getElementById('modal-type-name');
      if (sel.length === 0) {
        nameEl.textContent = 'Select at least one';
        nameEl.style.color = 'var(--gray-low)';
        saveBtn.setAttribute('disabled', '');
      } else {
        nameEl.textContent = getTypeName(sel);
        nameEl.style.color = 'var(--fg)';
        saveBtn.removeAttribute('disabled');
      }
    };

    allMods.forEach(m => body.querySelector('#mod-' + m).addEventListener('change', updateState));
    updateState();

    saveBtn.onclick = () => {
      const sel = allMods.filter(m => body.querySelector('#mod-' + m).checked);
      if (sel.length === 0) return;
      this._settings.modalities = sel;
      window.BT.NBackSettings.save(this._settings);
      this._updateHeader();
      this._renderMatchButtons();
      overlay.classList.remove('open');
    };

    overlay.querySelector('.modal-cancel-btn').onclick = () => overlay.classList.remove('open');
    overlay.classList.add('open');
  },

  _renderMatchButtons() {
    const container = document.getElementById('nb-match-btns');
    if (!container) return;
    container.innerHTML = `<span class="label" style="text-align:center;margin-bottom:6px">Response</span>` +
      this._settings.modalities.map(m => `
        <button class="nback-match-btn" data-mod="${m}" disabled>
          <span>${MOD_LABELS[m]}</span>
          <span class="key">${MOD_KEYS[m]}</span>
        </button>
      `).join('');

    container.querySelectorAll('.nback-match-btn').forEach(btn => {
      btn.addEventListener('click', () => this._handleMatch(btn.dataset.mod));
    });
  },

  _refreshCellStats() {
    const cells = document.querySelectorAll('.nback-cell');
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    this._cellStats.forEach((s, i) => {
      const hit = cells[i] && cells[i].querySelector('.hit em');
      if (hit) hit.textContent = `${s.hits}/${s.shown}`;
      const hz = cells[i] && cells[i].querySelector('.hz');
      if (hz) {
        const ratio = s.shown ? Math.round((s.hits / s.shown) * 100) : 0;
        hz.textContent = s.shown ? `${pad(ratio,2)}%` : '−';
      }
    });
  },

  async startSession() {
    if (this._running) return;

    this._sequence = window.BT.NBackEngine.generateSequence(this._settings);
    this._responses = {};
    this._currentIndex = -1;
    this._running = true;
    this._cellStats = Array.from({length: 9}, () => ({ shown: 0, hits: 0 }));
    this._refreshCellStats();

    document.getElementById('nb-start-area').style.display = 'none';
    document.getElementById('nb-results').style.display = 'none';
    this._renderMatchButtons();

    if (window.BT.Chrome) {
      window.BT.Chrome.beginRun();
      window.BT.Chrome.setPhase('STIM');
    }

    await this._countdown();
    this._nextTrial();
  },

  _countdown() {
    return new Promise(resolve => {
      const arena = document.querySelector('#view-nback .exercise-arena');
      let count = 3;
      const show = () => {
        let overlay = arena.querySelector('.countdown-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'countdown-overlay';
          arena.appendChild(overlay);
        }
        overlay.textContent = count;
        overlay.style.animation = 'none';
        overlay.offsetHeight;
        overlay.style.animation = 'countPulse 0.6s ease-out';

        if (count === 0) {
          overlay.textContent = 'Go!';
          setTimeout(() => { overlay.remove(); resolve(); }, 500);
        } else {
          count--;
          setTimeout(show, 800);
        }
      };
      show();
    });
  },

  _nextTrial() {
    if (!this._running) return;
    this._currentIndex++;

    if (this._currentIndex >= this._sequence.length) {
      this._endSession();
      return;
    }

    this._phase = 'show';
    const stim = this._sequence[this._currentIndex];
    const fireAt = performance.now();
    this._showStimulus(stim);
    this._cellStats[stim.position].shown++;
    this._refreshCellStats();
    this._updateProgress();
    this._updateTrialCounter();
    this._animateTrialBar(this._settings.trialTime);

    this._resetMatchButtons();

    if (window.BT.Chrome) {
      window.BT.Chrome.setPhase('STIM');
      window.BT.Chrome.setTrial(this._currentIndex + 1, this._sequence.length);
      window.BT.Chrome.tickRunning();
      window.BT.Chrome.paintLatency(fireAt);
    }

    this._timer = setTimeout(() => {
      this._scoreTrial();
      this._clearStimulus();
      this._phase = 'isi';
      if (window.BT.Chrome) window.BT.Chrome.setPhase('GAP');
      this._timer = setTimeout(() => this._nextTrial(), this._settings.isi);
    }, this._settings.trialTime);
  },

  _scoreTrial() {
    const stim = this._sequence[this._currentIndex];
    if (!stim || !stim.matches) return;
    const responded = this._responses[this._currentIndex] || {};
    if (stim.matches.position && responded.position) {
      this._cellStats[stim.position].hits++;
    }
    document.querySelectorAll('.nback-match-btn').forEach(btn => {
      const mod = btn.dataset.mod;
      const truth = !!stim.matches[mod];
      const said = !!responded[mod];
      btn.classList.remove('armed');
      if (said && truth)  btn.classList.add('hit');
      if (said && !truth) btn.classList.add('miss');
      if (!said && truth) btn.classList.add('miss');
      btn.disabled = true;
    });
    this._refreshCellStats();
  },

  _updateTrialCounter() {
    const counter = document.getElementById('nb-trial-counter');
    const num = document.getElementById('nb-trial-num');
    if (!counter || !num) return;
    counter.style.display = 'flex';
    const pad = (n) => String(n).padStart(2, '0');
    num.textContent = `${pad(this._currentIndex + 1)} / ${pad(this._sequence.length)}`;
  },

  _animateTrialBar(durationMs) {
    const bar = document.getElementById('nb-trial-bar-fill');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.getBoundingClientRect();
    bar.style.transition = `transform ${durationMs}ms linear`;
    bar.style.transform = 'scaleX(0)';
  },

  _resetTrialBar() {
    const bar = document.getElementById('nb-trial-bar-fill');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
  },

  _showStimulus(stim) {
    const cells = document.querySelectorAll('.nback-cell');
    cells.forEach(c => {
      c.classList.remove('active');
      const sh = c.querySelector('.cell-shape'); if (sh) sh.remove();
      const gl = c.querySelector('.glyph');      if (gl) gl.remove();
      const cn = c.querySelector('.cell-number'); if (cn) cn.remove();
      c.style.background = '';
    });

    const mods = this._settings.modalities;
    const activeCell = mods.includes('position') ? cells[stim.position] : null;
    const target = activeCell || cells[4];
    target.classList.add('active');

    if (mods.includes('color')) {
      target.style.background = stim.color;
    }

    if (mods.includes('shape')) {
      drawShape(target, stim.shape);
    }

    if (mods.includes('number')) {
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = stim.number;
      target.appendChild(glyph);
    }

    if (mods.includes('audio')) {
      window.BT.Audio.speak(stim.audio);
    }
  },

  _clearStimulus() {
    document.querySelectorAll('.nback-cell').forEach(c => {
      c.classList.remove('active');
      const sh = c.querySelector('.cell-shape'); if (sh) sh.remove();
      const gl = c.querySelector('.glyph');      if (gl) gl.remove();
      const cn = c.querySelector('.cell-number'); if (cn) cn.remove();
      c.style.background = '';
    });
  },

  _handleMatch(modality) {
    if (!this._running || this._phase !== 'show') return;
    const idx = this._currentIndex;
    if (idx < this._settings.n) return;
    if (!this._responses[idx]) this._responses[idx] = {};
    if (this._responses[idx][modality]) return;
    this._responses[idx][modality] = true;

    const btn = document.querySelector(`.nback-match-btn[data-mod="${modality}"]`);
    if (btn) btn.classList.add('armed');
  },

  _resetMatchButtons() {
    document.querySelectorAll('.nback-match-btn').forEach(b => {
      b.classList.remove('armed', 'hit', 'miss');
      b.disabled = false;
    });
  },

  _updateProgress() {
    // legacy hook — bottom progress was consolidated into the trial counter + bar above the grid
  },

  _endSession() {
    this._running = false;
    this._phase = 'idle';
    clearTimeout(this._timer);
    this._clearStimulus();
    this._resetTrialBar();
    if (window.BT.Chrome) window.BT.Chrome.endRun();
    const counter = document.getElementById('nb-trial-counter');
    if (counter) counter.style.display = 'none';

    const scores = window.BT.NBackEngine.computeScores(
      this._sequence, this._responses, this._settings.n, this._settings.modalities
    );

    let newLevel = this._settings.n;
    if (this._settings.adaptive) {
      newLevel = window.BT.NBackEngine.adaptLevel(this._settings.n, scores.avgDPrime);
    }

    const record = {
      exercise: 'nback',
      nbackLevel: this._settings.n,
      modalities: [...this._settings.modalities],
      trialCount: this._sequence.length,
      scores: scores.perModality,
      overallAccuracy: scores.avgAccuracy,
      avgDPrime: scores.avgDPrime,
      newLevel,
    };
    window.BT.Storage.addSession(record);
    if (window.BT.Streaks) window.BT.Streaks.refresh();

    this._showResults(scores, newLevel);

    if (newLevel !== this._settings.n) {
      this._settings.n = newLevel;
      window.BT.NBackSettings.save(this._settings);
    }

    this._updateHeader();
    window.BT.NBackSettings.renderTodaySets(document.querySelector('#nb-today-sets'));
  },

  _buildSummaryNote(scores) {
    const mods = this._settings.modalities;
    if (mods.length < 2) return null;
    const sorted = mods
      .map(m => ({ m, d: scores.perModality[m].dPrime }))
      .sort((a, b) => b.d - a.d);
    const top = sorted[0], bottom = sorted[sorted.length - 1];
    if (top.d - bottom.d < 0.5) return null;
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    return `${cap(top.m)} read clean. ${cap(bottom.m)} drifted — try focusing there next set.`;
  },

  _showResults(scores, newLevel) {
    const container = document.getElementById('nb-results');
    const oldLevel = this._settings.n;

    let levelHtml = '';
    if (newLevel > oldLevel) {
      levelHtml = `<div class="results-level-change up">Moving up — N${oldLevel} → N${newLevel}</div>`;
    } else if (newLevel < oldLevel) {
      levelHtml = `<div class="results-level-change down">Stepping back — N${oldLevel} → N${newLevel}</div>`;
    } else {
      levelHtml = `<div class="results-level-change same">Staying at N${oldLevel}</div>`;
    }

    let perModRows = '';
    for (const mod of this._settings.modalities) {
      const s = scores.perModality[mod];
      const label = mod[0].toUpperCase() + mod.slice(1);
      perModRows += `
        <div class="results-modality">
          <div class="results-modality-name">${label}</div>
          <div class="results-grid">
            <span class="r-label">Caught</span><span class="r-value">${s.hits} of ${s.hits + s.misses}</span>
            <span class="r-label">False alarms</span><span class="r-value">${s.falseAlarms}</span>
            <span class="r-label">Detection score</span><span class="r-value">${s.dPrime.toFixed(2)}</span>
            <span class="r-label">Accuracy</span><span class="r-value">${Math.round(s.accuracy * 100)}%</span>
          </div>
        </div>
      `;
    }

    const summary = this._buildSummaryNote(scores);

    container.innerHTML = `
      <div class="results-card">
        <h2>Set Complete</h2>
        ${levelHtml}
        ${summary ? `<div class="results-summary">${summary}</div>` : ''}
        <div class="results-grid">
          <span class="r-label">Detection score</span><span class="r-value">${scores.avgDPrime.toFixed(2)}</span>
          <span class="r-label">Overall accuracy</span><span class="r-value">${Math.round(scores.avgAccuracy * 100)}%</span>
        </div>
        ${perModRows}
        <div class="results-actions">
          <button class="btn btn-primary" id="nb-again-btn">Run another</button>
          <button class="btn btn-secondary" id="nb-done-btn">Done</button>
        </div>
      </div>
    `;
    container.style.display = 'flex';

    document.getElementById('nb-again-btn').addEventListener('click', () => {
      container.style.display = 'none';
      document.getElementById('nb-start-area').style.display = 'flex';
    });

    document.getElementById('nb-done-btn').addEventListener('click', () => {
      container.style.display = 'none';
      document.getElementById('nb-start-area').style.display = 'flex';
    });
  },

  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('view-nback').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT') return;

      const key = e.key.toUpperCase();

      if (key === ' ' || key === 'SPACE') {
        e.preventDefault();
        if (!this._running) this.startSession();
        return;
      }

      if (!this._running) return;

      for (const [mod, k] of Object.entries(MOD_KEYS)) {
        if (key === k && this._settings.modalities.includes(mod)) {
          e.preventDefault();
          this._handleMatch(mod);
          return;
        }
      }

      if (key === 'ESCAPE') {
        this._togglePause();
      }
    });
  },

  _abort() {
    if (!this._running && !this._pausedAt) return;
    this._running = false;
    this._paused = false;
    this._pausedAt = null;
    this._phase = 'idle';
    clearTimeout(this._timer);
    this._clearStimulus();
    this._resetTrialBar();
    if (window.BT.Chrome) window.BT.Chrome.endRun();
    const counter = document.getElementById('nb-trial-counter');
    if (counter) counter.style.display = 'none';
    document.getElementById('nb-start-area').style.display = 'flex';
    this._closePauseOverlay();
  },

  _togglePause() {
    if (this._paused) {
      this._closePauseOverlay();
      return;
    }
    if (!this._running) return;
    this._paused = true;
    clearTimeout(this._timer);
    this._pausedAt = { phase: this._phase, index: this._currentIndex };
    this._phase = 'paused';
    this._showPauseOverlay();
  },

  _showPauseOverlay() {
    let overlay = document.getElementById('nb-pause-overlay');
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'nb-pause-overlay';
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="width:340px">
        <div class="modal-header">Paused</div>
        <div class="modal-body">
          <p style="font-size:var(--text-sm);line-height:var(--leading-normal);color:var(--gray-mid);margin:0">
            You're partway through a set. Pick up where you left off, or stop and discard this set.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="quit">Stop set</button>
          <button class="btn btn-primary" data-action="resume">Resume</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="resume"]').addEventListener('click', () => this._resumeFromPause());
    overlay.querySelector('[data-action="quit"]').addEventListener('click', () => this._abort());
  },

  _closePauseOverlay() {
    const overlay = document.getElementById('nb-pause-overlay');
    if (overlay) overlay.remove();
  },

  _resumeFromPause() {
    if (!this._paused) return;
    this._closePauseOverlay();
    this._paused = false;
    this._currentIndex--;
    this._pausedAt = null;
    this._nextTrial();
  },

  stop() { this._abort(); }
};
