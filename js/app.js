window.BT = window.BT || {};

window.BT.App = {
  _currentView: 'nback',

  init() {
    window.BT.Audio.init();
    window.BT.NBackUI.init();
    window.BT.CWMUI.init();
    window.BT.Stats.init();
    window.BT.Onboarding.init();

    this._bindNav();
    this._bindGlobalKeys();

    const lastView = window.BT.Storage.get('bt_last_view', 'nback');
    this.switchView(lastView);
  },

  switchView(viewId) {
    this._currentView = viewId;
    window.BT.Storage.set('bt_last_view', viewId);

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + viewId);
    if (view) view.classList.add('active');

    document.querySelectorAll('.sidebar-nav li').forEach(li => {
      li.classList.toggle('active', li.dataset.view === viewId);
    });

    if (viewId === 'stats') {
      window.BT.Stats.refresh();
    }
  },

  _bindNav() {
    document.querySelectorAll('.sidebar-nav li[data-view]').forEach(li => {
      li.addEventListener('click', () => {
        this.switchView(li.dataset.view);
      });
    });
  },

  _bindGlobalKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === '1') { this.switchView('nback'); e.preventDefault(); }
      if (e.key === '2') { this.switchView('cwm'); e.preventDefault(); }
      if (e.key === '3') { this.switchView('stats'); e.preventDefault(); }

      if (e.key === '?') {
        e.preventDefault();
        this._toggleHelp();
      }
    });
  },

  _toggleHelp() {
    let overlay = document.getElementById('help-overlay');
    if (overlay) {
      overlay.remove();
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal help-modal">
        <div class="modal-header">Keyboard shortcuts</div>
        <div class="modal-body">
          <div class="help-section-title">Anywhere</div>
          <div class="setting-row"><span>N-Back</span><span class="kbd">1</span></div>
          <div class="setting-row"><span>Complex Working Memory</span><span class="kbd">2</span></div>
          <div class="setting-row"><span>Statistics</span><span class="kbd">3</span></div>
          <div class="setting-row"><span>This help</span><span class="kbd">?</span></div>
          <div class="setting-row"><span>Pause set</span><span class="kbd">Esc</span></div>

          <div class="help-section-title">N-Back</div>
          <div class="setting-row"><span>Begin</span><span class="kbd">Space</span></div>
          <div class="setting-row"><span>Position match</span><span class="kbd">A</span></div>
          <div class="setting-row"><span>Audio match</span><span class="kbd">S</span></div>
          <div class="setting-row"><span>Color match</span><span class="kbd">D</span></div>
          <div class="setting-row"><span>Shape match</span><span class="kbd">F</span></div>
          <div class="setting-row"><span>Number match</span><span class="kbd">G</span></div>

          <div class="help-section-title">Complex Working Memory</div>
          <div class="setting-row"><span>Begin</span><span class="kbd">Space</span></div>
          <div class="setting-row"><span>Yes</span><span class="kbd">A</span></div>
          <div class="setting-row"><span>No</span><span class="kbd">L</span></div>
          <div class="setting-row"><span>Undo recall</span><span class="kbd">⌫</span></div>
          <div class="setting-row"><span>Submit recall</span><span class="kbd">↵</span></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="help-close-btn">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.getElementById('help-close-btn').addEventListener('click', () => overlay.remove());
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.BT.App.init();
});
