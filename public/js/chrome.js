window.BT = window.BT || {};

window.BT.Chrome = {
  _startedAt: 0,
  _seed: 0,
  _phase: 'IDLE',
  _trial: 0,
  _trialTotal: 0,
  _tick: 0,
  _frameDt: 0,
  _paintMs: 0,
  _lastFrameT: 0,
  _running: false,

  init() {
    this._seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    this._updateSeed();
    this._startTickers();
    this._initFocus();
    this._initTZ();
  },

  setSeed() {
    this._seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    this._updateSeed();
    return this._seed;
  },

  _updateSeed() {
    const hex = '0x' + this._seed.toString(16).padStart(8, '0').toUpperCase();
    const seedEl = document.getElementById('bt-seed');
    const rngEl = document.getElementById('status-rng');
    if (seedEl) seedEl.textContent = `SEED ${hex}`;
    if (rngEl) rngEl.textContent = hex;
  },

  setPhase(phase) {
    this._phase = phase;
    const el = document.getElementById('status-phase');
    if (el) {
      el.textContent = phase;
      el.classList.toggle('live', phase !== 'IDLE' && phase !== 'DONE');
    }
  },

  setTrial(n, total) {
    this._trial = n;
    this._trialTotal = total;
    const pad = (v, w = 2) => String(v).padStart(w, '0');
    const el = document.getElementById('status-trial');
    if (el) el.textContent = total ? `${pad(n)} / ${pad(total)}` : '— / —';
  },

  tickRunning() {
    this._tick++;
    const el = document.getElementById('status-tick');
    if (el) el.textContent = String(this._tick).padStart(4, '0');
  },

  beginRun() {
    this._running = true;
    this._tick = 0;
    this._startedAt = performance.now();
    this.setSeed();
  },

  endRun() {
    this._running = false;
    this.setPhase('DONE');
  },

  paintLatency(fireAt) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dt = performance.now() - fireAt;
        this._paintMs = dt;
        const el = document.getElementById('status-paint');
        if (el) el.textContent = dt.toFixed(2) + ' ms';
      });
    });
  },

  _startTickers() {
    const tickFrame = (now) => {
      if (this._lastFrameT) {
        const dt = now - this._lastFrameT;
        this._frameDt = dt;
        const el = document.getElementById('status-frame');
        if (el) el.textContent = dt.toFixed(2) + ' ms';
      }
      this._lastFrameT = now;
      requestAnimationFrame(tickFrame);
    };
    requestAnimationFrame(tickFrame);

    setInterval(() => {
      const t = this._running ? Math.floor((performance.now() - this._startedAt) / 1000) : 0;
      const pad = (v) => String(v).padStart(2, '0');
      const txt = `RUNTIME ${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
      const el = document.getElementById('bt-heartbeat');
      if (el) el.textContent = txt;
    }, 1000);
  },

  _initFocus() {
    const el = document.getElementById('status-focus');
    if (!el) return;
    const update = () => { el.textContent = document.hasFocus() ? 'WIN' : 'BG'; };
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    update();
  },

  _initTZ() {
    const el = document.getElementById('status-tz');
    if (!el) return;
    const m = -new Date().getTimezoneOffset();
    const sign = m >= 0 ? '+' : '-';
    const abs = Math.abs(m);
    const pad = (v) => String(v).padStart(2, '0');
    el.textContent = `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  },
};
