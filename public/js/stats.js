window.BT = window.BT || {};

window.BT.Stats = {
  init() {
    this._renderView();
  },

  _renderView() {
    const view = document.getElementById('view-stats');
    const arena = view.querySelector('.exercise-arena');

    arena.innerHTML = `
      <div class="stats-wrap">
        <div class="stats-filter-row">
          <span class="eyebrow">Filter</span>
          <div class="tab-bar">
            <button class="active" data-filter="all">All</button>
            <button data-filter="nback">N-Back</button>
            <button data-filter="cwm">CWM</button>
          </div>
        </div>
        <div class="stats-chart-wrap">
          <div class="eyebrow chart-label">Performance Over Time</div>
          <canvas id="stats-chart" width="760" height="240" style="width:100%;height:240px"></canvas>
        </div>
        <div class="stats-table-wrap">
          <div class="eyebrow">Recent Sessions</div>
          <div id="stats-table-container"></div>
        </div>
        <div class="stats-actions">
          <button class="btn btn-secondary btn-sm" id="stats-clear-btn">Clear History</button>
        </div>
      </div>
    `;

    this._filter = 'all';

    arena.querySelectorAll('.tab-bar button').forEach(btn => {
      btn.addEventListener('click', () => {
        arena.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filter = btn.dataset.filter;
        this._renderData();
      });
    });

    document.getElementById('stats-clear-btn').addEventListener('click', () => {
      this._confirmClear();
    });
  },

  refresh() {
    this._renderData();
  },

  _confirmClear() {
    const total = window.BT.Storage.getSessions().length;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="width:380px">
        <div class="modal-header">Clear all history</div>
        <div class="modal-body">
          <p style="font-size:var(--text-sm);line-height:var(--leading-normal);color:var(--gray-mid);margin:0">
            This permanently deletes <strong style="color:var(--fg)">${total} session${total === 1 ? '' : 's'}</strong> from this browser. The action cannot be undone.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="cancel">Keep history</button>
          <button class="btn btn-primary" data-action="confirm" style="background:var(--error);border-color:var(--error)">Clear all</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      window.BT.Storage.clearSessions();
      this._renderData();
      close();
    });
  },

  _renderData() {
    const sessions = this._filter === 'all'
      ? window.BT.Storage.getSessions()
      : window.BT.Storage.getSessions(this._filter);

    this._drawChart(sessions);
    this._renderTable(sessions);
  },

  _drawChart(sessions) {
    const canvas = document.getElementById('stats-chart');
    if (!canvas) return;
    if (!canvas.style.height) canvas.style.height = '240px';
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth || 760;
    const ch = canvas.clientHeight || 260;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    const w = cw, h = ch;
    const pad = { top: 20, right: 20, bottom: 35, left: 50 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    const styles = getComputedStyle(document.documentElement);
    const fg = styles.getPropertyValue('--fg').trim() || '#000';
    const bg = styles.getPropertyValue('--bg').trim() || '#fff';
    const border = styles.getPropertyValue('--border').trim() || '#e5e7eb';
    const grayLow = styles.getPropertyValue('--gray-low').trim() || '#71717a';
    const grayMid = styles.getPropertyValue('--gray-mid').trim() || '#52525b';

    ctx.clearRect(0, 0, w, h);

    if (sessions.length < 2) {
      ctx.fillStyle = grayLow;
      ctx.font = '600 10px "IBM Plex Sans", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('NEED AT LEAST 2 SESSIONS', w / 2, h / 2);
      return;
    }

    const dataPoints = sessions.map(s => {
      if (s.exercise === 'nback') return s.avgDPrime ?? 0;
      return (s.combined ?? 0) * 5;
    });

    const yMin = 0;
    const yMax = Math.max(5, ...dataPoints) + 0.5;

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.font = '600 10px "IBM Plex Sans", system-ui';
    ctx.fillStyle = grayLow;
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
      const yVal = yMin + (yMax - yMin) * (i / 5);
      const y = pad.top + ph * (1 - i / 5);
      ctx.beginPath();
      ctx.moveTo(pad.left, y + 0.5);
      ctx.lineTo(w - pad.right, y + 0.5);
      ctx.stroke();
      ctx.fillText(yVal.toFixed(1), pad.left - 8, y + 4);
    }

    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(sessions.length / 8));
    for (let i = 0; i < sessions.length; i += step) {
      const x = pad.left + (i / (sessions.length - 1)) * pw;
      const d = new Date(sessions[i].timestamp);
      ctx.fillText(`${d.getMonth() + 1}.${d.getDate()}`, x, h - 8);
    }

    ctx.beginPath();
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    for (let i = 0; i < dataPoints.length; i++) {
      const x = pad.left + (i / (dataPoints.length - 1)) * pw;
      const y = pad.top + ph * (1 - (dataPoints[i] - yMin) / (yMax - yMin));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let i = 0; i < dataPoints.length; i++) {
      const x = pad.left + (i / (dataPoints.length - 1)) * pw;
      const y = pad.top + ph * (1 - (dataPoints[i] - yMin) / (yMax - yMin));
      const isNback = sessions[i].exercise === 'nback';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      if (isNback) {
        ctx.fillStyle = fg;
        ctx.fill();
      } else {
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  },

  _renderTable(sessions) {
    const container = document.getElementById('stats-table-container');
    const recent = sessions.slice(-20).reverse();

    if (!recent.length) {
      container.innerHTML = '<div class="empty-state">No sessions yet. Complete a training set to see your history.</div>';
      return;
    }

    container.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Exercise</th>
            <th class="num">Level</th>
            <th class="num">Accuracy</th>
            <th class="num">Score</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(s => {
            const d = new Date(s.timestamp);
            const date = `${d.getMonth() + 1}.${d.getDate()} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            const exercise = s.exercise === 'nback' ? `N-Back · ${(s.modalities || []).map(m => m[0].toUpperCase()).join('')}` : `CWM · ${s.cwmType || ''}`;
            const level = s.exercise === 'nback' ? s.nbackLevel : s.cwmLevel;
            const accuracy = s.exercise === 'nback' ? Math.round((s.overallAccuracy || 0) * 100) : Math.round((s.combined || 0) * 100);
            const score = s.exercise === 'nback' ? `d′ ${(s.avgDPrime || 0).toFixed(1)}` : `${Math.round((s.recallAccuracy || 0) * 100)}% recall`;
            return `<tr>
              <td>${date}</td>
              <td>${exercise}</td>
              <td class="num">${level}</td>
              <td class="num">${accuracy}%</td>
              <td class="num">${score}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }
};
