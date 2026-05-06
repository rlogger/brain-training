window.BT = window.BT || {};

window.BT.CWMUI = {
  _settings: null,
  _rounds: [],
  _phase: 'idle',
  _currentRound: 0,
  _currentDecision: 0,
  _decisionResponses: [],
  _recallResponses: [],
  _rememberItems: [],
  _recallStep: 0,
  _timer: null,
  _running: false,

  init() {
    this._settings = window.BT.CWMSettings.load();
    this._renderView();
    this._bindKeys();
  },

  _getDisplayType() {
    if (this._settings.type !== 'combined') return this._settings.type;
    return this._rounds[this._currentRound].roundType;
  },

  _getRememberType() {
    if (this._settings.type !== 'combined') return this._settings.type;
    return this._rounds[this._currentRound].rememberType;
  },

  _getRememberValue(item) {
    return item && typeof item === 'object' ? item.value : item;
  },

  _renderView() {
    const view = document.getElementById('view-cwm');
    const arena = view.querySelector('.exercise-arena');
    const panel = view.querySelector('.exercise-panel');
    const s = this._settings;
    const sel = (v) => s.type === v ? 'selected' : '';

    arena.innerHTML = `
      <div class="cwm-setup">
        <div class="cwm-setup-row">
          <div class="cwm-setup-field">
            <label class="eyebrow">Type</label>
            <select class="input-field" id="cwm-type-select">
              <option value="verbal" ${sel('verbal')}>Verbal</option>
              <option value="spatial" ${sel('spatial')}>Spatial</option>
              <option value="combined" ${sel('combined')}>Combined</option>
            </select>
          </div>
          <div class="cwm-setup-field">
            <label class="eyebrow">Level</label>
            <select class="input-field" id="cwm-level-select">
              ${Array.from({length: 14}, (_, i) => i + 2).map(n =>
                `<option value="${n}" ${n === s.level ? 'selected' : ''}>${n}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="cwm-start-area" id="cwm-start-area">
        <button class="btn btn-primary btn-lg" id="cwm-start-btn">Start</button>
        <div class="cwm-start-hint">Press <span class="kbd">Space</span> to start · <span class="kbd">?</span> for help</div>
      </div>
      <div id="cwm-arena-content" style="display:none;flex-direction:column;align-items:center;width:100%">
        <div class="cwm-phase-label" id="cwm-phase-label"></div>
        <div class="cwm-display-wrap">
          <div class="cwm-trial-bar">
            <div class="cwm-trial-bar-fill" id="cwm-trial-bar-fill"></div>
          </div>
          <div id="cwm-display-area" style="display:flex;align-items:center;justify-content:center;min-height:280px"></div>
          <div class="cwm-feedback-flash" id="cwm-feedback"></div>
        </div>
        <div class="cwm-decision-buttons" id="cwm-decision-btns" style="display:none">
          <button class="btn btn-secondary" id="cwm-yes-btn">Yes <span class="kbd">${s.keyYes}</span></button>
          <button class="btn btn-secondary" id="cwm-no-btn">No <span class="kbd">${s.keyNo}</span></button>
        </div>
      </div>
      <div id="cwm-results" style="display:none"></div>
    `;

    window.BT.CWMSettings.renderPanel(panel, this._settings, (updated) => {
      this._settings = updated;
      this._syncSelects();
    });

    this._bindUIEvents();
    this._syncSelects();
  },

  _syncSelects() {
    const typeEl = document.getElementById('cwm-type-select');
    const levelEl = document.getElementById('cwm-level-select');
    if (typeEl) typeEl.value = this._settings.type;
    if (levelEl) levelEl.value = this._settings.level;
    window.BT.CWMSettings.renderPanel(
      document.querySelector('#view-cwm .exercise-panel'),
      this._settings,
      (s) => { this._settings = s; this._syncSelects(); }
    );
  },

  _bindUIEvents() {
    document.getElementById('cwm-start-btn').addEventListener('click', () => this.startSession());

    document.getElementById('cwm-type-select').addEventListener('change', (e) => {
      if (this._running) return;
      this._settings.type = e.target.value;
      window.BT.CWMSettings.save(this._settings);
      this._syncSelects();
    });

    document.getElementById('cwm-level-select').addEventListener('change', (e) => {
      if (this._running) return;
      this._settings.level = parseInt(e.target.value, 10);
      window.BT.CWMSettings.save(this._settings);
      this._syncSelects();
    });

    document.getElementById('cwm-yes-btn').addEventListener('click', () => this._handleDecision(true));
    document.getElementById('cwm-no-btn').addEventListener('click', () => this._handleDecision(false));
  },

  async startSession() {
    if (this._running) return;
    this._running = true;
    this._decisionResponses = [];
    this._recallResponses = [];
    this._rememberItems = [];
    this._currentRound = 0;
    this._currentDecision = 0;
    this._recallStep = 0;

    this._rounds = window.BT.CWMEngine.generateSession(this._settings);

    document.getElementById('cwm-start-area').style.display = 'none';
    document.getElementById('cwm-results').style.display = 'none';
    document.getElementById('cwm-arena-content').style.display = 'flex';

    await this._countdown();
    this._runRound();
  },

  _countdown() {
    return new Promise(resolve => {
      const area = document.getElementById('cwm-display-area');
      let count = 3;
      const show = () => {
        area.innerHTML = `<div class="countdown-overlay" style="position:relative;inset:auto;background:none">${count || 'Go!'}</div>`;
        if (count === 0) {
          setTimeout(() => { area.innerHTML = ''; resolve(); }, 500);
        } else {
          count--;
          setTimeout(show, 800);
        }
      };
      show();
    });
  },

  _runRound() {
    if (this._currentRound >= this._settings.level) {
      this._startRecall();
      return;
    }
    this._currentDecision = 0;
    this._runDecision();
  },

  _runDecision() {
    const round = this._rounds[this._currentRound];
    if (this._currentDecision >= this._settings.decisionsPerRound) {
      this._showRememberItem();
      return;
    }

    this._phase = 'decision';
    const decision = round.decisions[this._currentDecision];
    const display = document.getElementById('cwm-display-area');
    const btns = document.getElementById('cwm-decision-btns');
    const displayType = this._getDisplayType();

    this._updatePhaseLabel(`Round ${this._currentRound + 1}/${this._settings.level} — Decision ${this._currentDecision + 1}/${this._settings.decisionsPerRound}`);

    if (displayType === 'spatial') {
      display.innerHTML = `<canvas id="cwm-figure" class="cwm-figure-canvas" width="280" height="280"></canvas>`;
      this._drawFigure(document.getElementById('cwm-figure'), decision.figure);
    } else {
      display.innerHTML = `<div class="cwm-word-display">${decision.word}</div>`;
    }

    btns.style.display = 'flex';
    this._animateTrialBar(this._settings.trialTime);
    document.getElementById('cwm-yes-btn').innerHTML = `${displayType === 'spatial' ? 'Symmetric' : 'Correct'} <span class="kbd">${this._settings.keyYes}</span>`;
    document.getElementById('cwm-no-btn').innerHTML = `${displayType === 'spatial' ? 'Not Symmetric' : 'Incorrect'} <span class="kbd">${this._settings.keyNo}</span>`;

    this._timer = setTimeout(() => {
      this._handleDecision(null);
    }, this._settings.trialTime);
  },

  _handleDecision(answer) {
    if (this._phase !== 'decision') return;
    this._phase = 'feedback';
    clearTimeout(this._timer);

    const round = this._rounds[this._currentRound];
    const decision = round.decisions[this._currentDecision];
    const displayType = this._getDisplayType();
    const expected = displayType === 'spatial' ? decision.isSymmetric : decision.isCorrect;
    const correct = answer === expected;

    this._decisionResponses.push({
      roundIndex: this._currentRound,
      decisionIndex: this._currentDecision,
      correct,
      responded: answer !== null,
    });

    if (this._settings.feedback) {
      const fb = document.getElementById('cwm-feedback');
      fb.textContent = correct ? '✓' : '✗';
      fb.style.color = correct ? 'var(--success)' : 'var(--error)';
      fb.classList.add('show');
      setTimeout(() => fb.classList.remove('show'), 400);
    }

    document.getElementById('cwm-decision-btns').style.display = 'none';
    this._resetTrialBar();

    setTimeout(() => {
      this._currentDecision++;
      this._runDecision();
    }, 600);
  },

  _animateTrialBar(durationMs) {
    const bar = document.getElementById('cwm-trial-bar-fill');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.getBoundingClientRect();
    bar.style.transition = `transform ${durationMs}ms linear`;
    bar.style.transform = 'scaleX(0)';
  },

  _resetTrialBar() {
    const bar = document.getElementById('cwm-trial-bar-fill');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
  },

  _showRememberItem() {
    this._phase = 'remember';
    const round = this._rounds[this._currentRound];
    const display = document.getElementById('cwm-display-area');
    const rememberType = this._getRememberType();
    const val = this._getRememberValue(round.rememberItem);
    document.getElementById('cwm-decision-btns').style.display = 'none';

    this._updatePhaseLabel(`Round ${this._currentRound + 1}/${this._settings.level} — <strong>Remember this!</strong>`);

    if (rememberType === 'spatial') {
      display.innerHTML = `<div class="cwm-recall-grid" id="cwm-remember-grid">${
        Array(16).fill(0).map((_, i) => `<div class="cwm-recall-cell ${i === val ? 'highlighted' : ''}" data-cell="${i}"></div>`).join('')
      }</div>`;
    } else {
      display.innerHTML = `<div class="cwm-letter-display">${val}</div>`;
    }

    this._rememberItems.push(round.rememberItem);

    setTimeout(() => {
      display.innerHTML = '';
      this._updatePhaseLabel('');
      setTimeout(() => {
        this._currentRound++;
        this._runRound();
      }, 500);
    }, 1500);
  },

  _startRecall() {
    this._phase = 'recall';
    this._recallResponses = [];
    this._recallStep = 0;
    const display = document.getElementById('cwm-display-area');
    document.getElementById('cwm-decision-btns').style.display = 'none';

    if (this._settings.type === 'combined') {
      this._renderCombinedRecallStep(display);
    } else if (this._settings.type === 'spatial') {
      this._renderSpatialRecall(display);
    } else {
      this._renderVerbalRecall(display);
    }
  },

  _renderSpatialRecall(display) {
    this._updatePhaseLabel(`Recall — Select items in order (${this._settings.level} items)`);
    display.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
        <div class="cwm-recall-sequence" id="cwm-recall-seq">
          ${Array(this._settings.level).fill(0).map(() => '<div class="cwm-recall-placeholder"></div>').join('')}
        </div>
        <div class="cwm-recall-grid" id="cwm-recall-grid">
          ${Array(16).fill(0).map((_, i) => `<div class="cwm-recall-cell" data-cell="${i}">${i + 1}</div>`).join('')}
        </div>
        <div class="cwm-recall-controls">
          <button class="btn btn-secondary btn-sm" id="cwm-undo-btn">Undo</button>
          <button class="btn btn-primary" id="cwm-submit-btn">Submit</button>
        </div>
      </div>
    `;
    display.querySelectorAll('.cwm-recall-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (this._recallResponses.length >= this._settings.level) return;
        const idx = parseInt(cell.dataset.cell, 10);
        this._recallResponses.push(idx);
        cell.classList.add('selected');
        this._updateRecallSequence();
      });
    });
    document.getElementById('cwm-undo-btn').addEventListener('click', () => this._undoRecall());
    document.getElementById('cwm-submit-btn').addEventListener('click', () => this._submitRecall());
  },

  _renderVerbalRecall(display) {
    this._updatePhaseLabel(`Recall — Select items in order (${this._settings.level} items)`);
    display.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
        <div class="cwm-recall-sequence" id="cwm-recall-seq">
          ${Array(this._settings.level).fill(0).map(() => '<div class="cwm-recall-placeholder"></div>').join('')}
        </div>
        <div class="cwm-letter-bank" id="cwm-letter-bank">
          ${window.BT.CWM_LETTERS.map(l => `<button class="cwm-letter-btn" data-letter="${l}">${l}</button>`).join('')}
        </div>
        <div class="cwm-recall-controls">
          <button class="btn btn-secondary btn-sm" id="cwm-undo-btn">Undo</button>
          <button class="btn btn-primary" id="cwm-submit-btn">Submit</button>
        </div>
      </div>
    `;
    display.querySelectorAll('.cwm-letter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._recallResponses.length >= this._settings.level) return;
        this._recallResponses.push(btn.dataset.letter);
        btn.classList.add('selected');
        this._updateRecallSequence();
      });
    });
    document.getElementById('cwm-undo-btn').addEventListener('click', () => this._undoRecall());
    document.getElementById('cwm-submit-btn').addEventListener('click', () => this._submitRecall());
  },

  _renderCombinedRecallStep(display) {
    const step = this._recallStep;
    const total = this._settings.level;
    if (step >= total) {
      this._updatePhaseLabel(`Recall — All ${total} items selected`);
      display.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
          <div class="cwm-recall-sequence" id="cwm-recall-seq"></div>
          <div class="cwm-recall-controls">
            <button class="btn btn-secondary btn-sm" id="cwm-undo-btn">Undo</button>
            <button class="btn btn-primary" id="cwm-submit-btn">Submit</button>
          </div>
        </div>
      `;
      this._updateRecallSequence();
      document.getElementById('cwm-undo-btn').addEventListener('click', () => this._undoRecall());
      document.getElementById('cwm-submit-btn').addEventListener('click', () => this._submitRecall());
      return;
    }

    const round = this._rounds[step];
    const rType = round.rememberType;
    const typeLabel = rType === 'spatial' ? 'Grid position' : 'Letter';
    this._updatePhaseLabel(`Recall — Item ${step + 1} of ${total} (${typeLabel})`);

    if (rType === 'spatial') {
      display.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
          <div class="cwm-recall-sequence" id="cwm-recall-seq"></div>
          <div class="cwm-recall-grid" id="cwm-recall-grid">
            ${Array(16).fill(0).map((_, i) => `<div class="cwm-recall-cell" data-cell="${i}">${i + 1}</div>`).join('')}
          </div>
          <div class="cwm-recall-controls">
            <button class="btn btn-secondary btn-sm" id="cwm-undo-btn">Undo</button>
          </div>
        </div>
      `;
      display.querySelectorAll('.cwm-recall-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const idx = parseInt(cell.dataset.cell, 10);
          this._recallResponses.push(idx);
          this._recallStep++;
          this._renderCombinedRecallStep(display);
        });
      });
    } else {
      display.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
          <div class="cwm-recall-sequence" id="cwm-recall-seq"></div>
          <div class="cwm-letter-bank" id="cwm-letter-bank">
            ${window.BT.CWM_LETTERS.map(l => `<button class="cwm-letter-btn" data-letter="${l}">${l}</button>`).join('')}
          </div>
          <div class="cwm-recall-controls">
            <button class="btn btn-secondary btn-sm" id="cwm-undo-btn">Undo</button>
          </div>
        </div>
      `;
      display.querySelectorAll('.cwm-letter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._recallResponses.push(btn.dataset.letter);
          this._recallStep++;
          this._renderCombinedRecallStep(display);
        });
      });
    }

    this._updateRecallSequence();
    document.getElementById('cwm-undo-btn').addEventListener('click', () => this._undoRecall());
  },

  _updateRecallSequence() {
    const seq = document.getElementById('cwm-recall-seq');
    if (!seq) return;
    seq.innerHTML = '';
    for (let i = 0; i < this._settings.level; i++) {
      if (i < this._recallResponses.length) {
        const val = this._recallResponses[i];
        const isCombined = this._settings.type === 'combined';
        const itemType = isCombined ? this._rounds[i].rememberType : this._settings.type;
        const label = itemType === 'spatial' ? (val + 1) : val;
        seq.innerHTML += `<div class="cwm-recall-item">${label}</div>`;
      } else {
        seq.innerHTML += '<div class="cwm-recall-placeholder"></div>';
      }
    }
  },

  _undoRecall() {
    if (!this._recallResponses.length) return;
    const removed = this._recallResponses.pop();

    if (this._settings.type === 'combined') {
      this._recallStep = this._recallResponses.length;
      this._renderCombinedRecallStep(document.getElementById('cwm-display-area'));
      return;
    }

    if (this._settings.type === 'spatial') {
      const cells = document.querySelectorAll('#cwm-recall-grid .cwm-recall-cell');
      cells.forEach(c => {
        if (parseInt(c.dataset.cell, 10) === removed) {
          c.classList.remove('selected');
          c.style.color = '';
        }
      });
    } else {
      const btns = document.querySelectorAll('.cwm-letter-btn');
      let found = false;
      for (let i = btns.length - 1; i >= 0; i--) {
        if (btns[i].dataset.letter === removed && btns[i].classList.contains('selected') && !found) {
          btns[i].classList.remove('selected');
          found = true;
        }
      }
    }
    this._updateRecallSequence();
  },

  _submitRecall() {
    if (this._phase !== 'recall') return;
    this._phase = 'results';

    const scores = window.BT.CWMEngine.computeScores(
      this._rounds, this._decisionResponses, this._recallResponses, this._settings.level
    );

    let newLevel = this._settings.level;
    if (this._settings.adaptive) {
      newLevel = window.BT.CWMEngine.adaptLevel(this._settings.level, scores.combined, this._settings);
    }

    this._showRecallFeedback();

    setTimeout(() => {
      const record = {
        exercise: 'cwm',
        cwmType: this._settings.type,
        cwmLevel: this._settings.level,
        decisionAccuracy: scores.decisionAccuracy,
        recallAccuracy: scores.recallAccuracy,
        combined: scores.combined,
        correctRecalls: scores.correctRecalls,
        newLevel,
      };
      window.BT.Storage.addSession(record);
      if (window.BT.Streaks) window.BT.Streaks.refresh();

      this._showResults(scores, newLevel);

      if (newLevel !== this._settings.level) {
        this._settings.level = newLevel;
        window.BT.CWMSettings.save(this._settings);
      }
      this._syncSelects();
      window.BT.CWMSettings.renderTodaySets(document.querySelector('#cwm-today-sets'));
    }, 1500);
  },

  _showRecallFeedback() {
    if (this._settings.type === 'combined') return;

    const expected = this._rounds.map(r => r.rememberItem);

    if (this._settings.type === 'spatial') {
      const cells = document.querySelectorAll('#cwm-recall-grid .cwm-recall-cell');
      for (let i = 0; i < this._recallResponses.length; i++) {
        const cell = cells[this._recallResponses[i]];
        if (cell) {
          const correct = this._recallResponses[i] === expected[i];
          cell.classList.remove('selected');
          cell.classList.add(correct ? 'correct' : 'incorrect');
        }
      }
      expected.forEach((pos, i) => {
        if (!this._recallResponses.includes(pos) || this._recallResponses[i] !== pos) {
          const cell = cells[pos];
          if (cell && !cell.classList.contains('correct')) {
            cell.style.borderColor = 'var(--success)';
            cell.style.borderStyle = 'dashed';
          }
        }
      });
    }
  },

  _showResults(scores, newLevel) {
    const container = document.getElementById('cwm-results');
    const oldLevel = this._settings.level;

    let levelHtml = '';
    if (newLevel > oldLevel) {
      levelHtml = `<div class="results-level-change up">Moving up — ${oldLevel} → ${newLevel} items</div>`;
    } else if (newLevel < oldLevel) {
      levelHtml = `<div class="results-level-change down">Stepping back — ${oldLevel} → ${newLevel} items</div>`;
    } else {
      levelHtml = `<div class="results-level-change same">Staying at ${oldLevel} items</div>`;
    }

    const dec = scores.decisionAccuracy;
    const rec = scores.recallAccuracy;
    let note = '';
    if (rec >= 0.9 && dec < 0.7) note = 'Recall held; the side task tripped you up. Slow down on decisions.';
    else if (dec >= 0.9 && rec < 0.5) note = 'Decisions sharp, but the items slipped. Rehearse them between rounds.';
    else if (rec === 1 && dec >= 0.85) note = 'A clean run.';

    container.innerHTML = `
      <div class="results-card">
        <h2>Set Complete</h2>
        ${levelHtml}
        ${note ? `<div class="results-summary">${note}</div>` : ''}
        <div class="results-grid">
          <span class="r-label">Items recalled</span><span class="r-value">${scores.correctRecalls} of ${this._settings.level}</span>
          <span class="r-label">Recall accuracy</span><span class="r-value">${Math.round(rec * 100)}%</span>
          <span class="r-label">Decisions correct</span><span class="r-value">${scores.correctDecisions} of ${scores.totalDecisions}</span>
          <span class="r-label">Decision accuracy</span><span class="r-value">${Math.round(dec * 100)}%</span>
          <span class="r-label">Combined score</span><span class="r-value">${Math.round(scores.combined * 100)}%</span>
        </div>
        <div class="results-actions">
          <button class="btn btn-primary" id="cwm-again-btn">Run another</button>
          <button class="btn btn-secondary" id="cwm-done-btn">Done</button>
        </div>
      </div>
    `;

    document.getElementById('cwm-arena-content').style.display = 'none';
    container.style.display = 'flex';

    document.getElementById('cwm-again-btn').addEventListener('click', () => {
      container.style.display = 'none';
      document.getElementById('cwm-start-area').style.display = 'flex';
    });

    document.getElementById('cwm-done-btn').addEventListener('click', () => {
      container.style.display = 'none';
      document.getElementById('cwm-start-area').style.display = 'flex';
    });

    this._running = false;
  },

  _drawFigure(canvas, grid) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cellW = w / 5, cellH = h / 5;
    const pad = 4;

    const styles = getComputedStyle(document.documentElement);
    const fg = styles.getPropertyValue('--fg').trim() || '#000';
    const border = styles.getPropertyValue('--border').trim() || '#e5e7eb';
    const grayLow = styles.getPropertyValue('--gray-low').trim() || '#71717a';

    ctx.clearRect(0, 0, w, h);

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const x = c * cellW + pad;
        const y = r * cellH + pad;
        const cw = cellW - pad * 2;
        const ch = cellH - pad * 2;

        if (grid[r][c]) {
          ctx.fillStyle = fg;
          ctx.fillRect(x, y, cw, ch);
        } else {
          ctx.strokeStyle = border;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
        }
      }
    }

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = grayLow;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  },

  _updatePhaseLabel(text) {
    const el = document.getElementById('cwm-phase-label');
    if (el) el.innerHTML = text;
  },

  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('view-cwm').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const key = e.key.toUpperCase();

      if (key === ' ' || key === 'SPACE') {
        e.preventDefault();
        if (!this._running) this.startSession();
        return;
      }

      if (this._phase === 'decision') {
        if (key === this._settings.keyYes) {
          e.preventDefault();
          this._handleDecision(true);
        } else if (key === this._settings.keyNo) {
          e.preventDefault();
          this._handleDecision(false);
        }
      }

      if (this._phase === 'recall') {
        if (key === 'BACKSPACE') {
          e.preventDefault();
          this._undoRecall();
        } else if (key === 'ENTER') {
          e.preventDefault();
          this._submitRecall();
        }
        if (this._settings.type === 'verbal' || this._settings.type === 'combined') {
          const letterBtn = document.querySelector(`.cwm-letter-btn[data-letter="${key}"]`);
          if (letterBtn) {
            e.preventDefault();
            letterBtn.click();
          }
        }
      }

      if (key === 'ESCAPE') {
        e.preventDefault();
        if (this._running) this._abort();
      }
    });
  },

  _togglePause() {
    if (!this._running) return;
    if (this._paused) {
      this._closePauseOverlay();
      return;
    }
    this._paused = true;
    clearTimeout(this._timer);
    this._showPauseOverlay();
  },

  _showPauseOverlay() {
    let overlay = document.getElementById('cwm-pause-overlay');
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'cwm-pause-overlay';
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
    const overlay = document.getElementById('cwm-pause-overlay');
    if (overlay) overlay.remove();
  },

  _resumeFromPause() {
    if (!this._paused) return;
    this._closePauseOverlay();
    this._paused = false;
    if (this._phase === 'decision') {
      this._currentDecision--;
      this._runDecision();
    }
  },

  _abort() {
    this._running = false;
    this._paused = false;
    this._phase = 'idle';
    clearTimeout(this._timer);
    this._resetTrialBar();
    this._closePauseOverlay();
    document.getElementById('cwm-arena-content').style.display = 'none';
    document.getElementById('cwm-start-area').style.display = 'flex';
  },

  stop() {
    this._running = false;
    this._phase = 'idle';
    clearTimeout(this._timer);
  }
};
