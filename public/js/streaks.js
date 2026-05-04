window.BT = window.BT || {};

window.BT.Streaks = {
  refresh() {
    const data = this._compute();
    this._render(data);
  },

  _compute() {
    const sessions = window.BT.Storage.getSessions();
    if (!sessions.length) return { currentStreak: 0, longestStreak: 0, trainedToday: false };

    const daySet = new Set();
    for (const s of sessions) {
      const d = new Date(s.timestamp);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }

    const days = [...daySet].map(k => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m, d);
    }).sort((a, b) => b - a);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const trainedToday = daySet.has(todayKey);

    let currentStreak = 0;
    const ref = new Date(today);
    ref.setHours(0, 0, 0, 0);

    if (!trainedToday) {
      ref.setDate(ref.getDate() - 1);
    }

    for (const day of days) {
      day.setHours(0, 0, 0, 0);
      if (day.getTime() === ref.getTime()) {
        currentStreak++;
        ref.setDate(ref.getDate() - 1);
      } else if (day.getTime() < ref.getTime()) {
        break;
      }
    }

    let longestStreak = 0;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
      days[i].setHours(0, 0, 0, 0);
      days[i - 1].setHours(0, 0, 0, 0);
      const diff = days[i - 1].getTime() - days[i].getTime();
      if (diff === 86400000) {
        run++;
      } else {
        longestStreak = Math.max(longestStreak, run);
        run = 1;
      }
    }
    longestStreak = Math.max(longestStreak, run);

    return { currentStreak, longestStreak, trainedToday };
  },

  _render({ currentStreak, longestStreak, trainedToday }) {
    const el = document.getElementById('streak-display');
    if (!el) return;
    el.innerHTML = `
      <div class="panel-row" style="padding:0 2rem">
        <span class="label">Current</span>
        <span class="value">${currentStreak} day${currentStreak !== 1 ? 's' : ''}</span>
      </div>
      <div class="panel-row" style="padding:0 2rem">
        <span class="label">Longest</span>
        <span class="value">${longestStreak} day${longestStreak !== 1 ? 's' : ''}</span>
      </div>
      <div style="padding:0 2rem;font-size:var(--text-xs);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${trainedToday ? 'var(--success)' : 'var(--gray-low)'};padding-top:.375rem">
        ${trainedToday ? 'Trained today' : 'Not yet today'}
      </div>
    `;
  }
};
