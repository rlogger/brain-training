window.BT = window.BT || {};

const HOWTO_NBACK = `
  <div class="howto-eyebrow">N-Back · how it works</div>
  <p>You'll see a sequence of stimuli — a square in the grid, a spoken letter, sometimes a colour or shape.</p>
  <p>Press the matching key when the <strong>current</strong> stimulus is the same as the one shown <strong>N steps back</strong>.</p>
  <div class="howto-example">
    <div class="howto-example-row">
      <span class="howto-step">N1</span>
      <span class="howto-step-label">centre · "T"</span>
    </div>
    <div class="howto-example-row">
      <span class="howto-step">N2</span>
      <span class="howto-step-label">top-left · "K"</span>
    </div>
    <div class="howto-example-row matches">
      <span class="howto-step">N3</span>
      <span class="howto-step-label">centre · "M"   <strong>position match — press A</strong></span>
    </div>
  </div>
  <p>Each modality is independent: position can match while audio doesn't. Press the key for any matching modality only.</p>
  <div class="howto-keys">
    <div><span class="kbd">A</span> Position · <span class="kbd">S</span> Audio · <span class="kbd">D</span> Color · <span class="kbd">F</span> Shape · <span class="kbd">G</span> Number</div>
    <div><span class="kbd">Space</span> begin · <span class="kbd">Esc</span> pause</div>
  </div>
`;

const HOWTO_CWM = `
  <div class="howto-eyebrow">Complex Working Memory · how it works</div>
  <p>The set has rounds. Each round asks you to make a few quick decisions, then shows one item to remember.</p>
  <div class="howto-example">
    <div class="howto-example-row"><span class="howto-step">1</span><span class="howto-step-label">Decide · "is this figure symmetric?"</span></div>
    <div class="howto-example-row"><span class="howto-step">2</span><span class="howto-step-label">Decide · "is this word spelled right?"</span></div>
    <div class="howto-example-row"><span class="howto-step">3</span><span class="howto-step-label">Decide · …</span></div>
    <div class="howto-example-row matches"><span class="howto-step">★</span><span class="howto-step-label"><strong>Remember this item.</strong></span></div>
  </div>
  <p>After all rounds, you'll be asked to recall the items in the order they appeared.</p>
  <p><strong>Spatial</strong> uses grid figures + grid positions. <strong>Verbal</strong> uses spelling judgments + letters.</p>
  <div class="howto-keys">
    <div><span class="kbd">A</span> yes · <span class="kbd">L</span> no · <span class="kbd">⌫</span> undo recall · <span class="kbd">↵</span> submit</div>
  </div>
`;

window.BT.Onboarding = {
  KEY_FLAG: 'bt_onboarded',
  KEY_HOWTO_LAST: 'bt_howto_last_seen',

  init() {
    this._injectHelpPanel('nback', HOWTO_NBACK);
    this._injectHelpPanel('cwm', HOWTO_CWM);
    this._bindHelpButtons();
    this._maybeShowFirstRun();
  },

  _injectHelpPanel(view, html) {
    const section = document.getElementById('view-' + view);
    const body = section.querySelector('.exercise-body');
    const panel = document.createElement('aside');
    panel.id = view + '-howto-panel';
    panel.className = 'howto-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="howto-panel-inner">
        ${html}
        <button class="btn btn-secondary btn-sm howto-close" data-view="${view}">Close</button>
      </div>
    `;
    body.appendChild(panel);
  },

  _bindHelpButtons() {
    const map = { 'nb-howto-btn': 'nback', 'cwm-howto-btn': 'cwm' };
    Object.entries(map).forEach(([btnId, view]) => {
      const btn = document.getElementById(btnId);
      if (btn) btn.addEventListener('click', () => this.toggleHelp(view));
    });
    document.querySelectorAll('.howto-close').forEach(b => {
      b.addEventListener('click', () => this.closeHelp(b.dataset.view));
    });
  },

  toggleHelp(view) {
    const panel = document.getElementById(view + '-howto-panel');
    if (!panel) return;
    const wasOpen = panel.classList.contains('open');
    document.querySelectorAll('.howto-panel').forEach(p => p.classList.remove('open'));
    if (!wasOpen) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      window.BT.Storage.set(this.KEY_HOWTO_LAST, view);
    } else {
      panel.setAttribute('aria-hidden', 'true');
    }
  },

  closeHelp(view) {
    const panel = document.getElementById(view + '-howto-panel');
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
  },

  _maybeShowFirstRun() {
    const onboarded = window.BT.Storage.get(this.KEY_FLAG, false);
    const sessions = window.BT.Storage.getSessions();
    if (onboarded || sessions.length > 0) return;
    setTimeout(() => this.showFirstRun(), 400);
  },

  showFirstRun() {
    const view = window.BT.App._currentView;
    if (view === 'stats') return;
    if (view === 'cwm') {
      this.toggleHelp('cwm');
    } else {
      this.toggleHelp('nback');
    }
    window.BT.Storage.set(this.KEY_FLAG, true);
  },

  reset() {
    window.BT.Storage.set(this.KEY_FLAG, false);
  }
};
