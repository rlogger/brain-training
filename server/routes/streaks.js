const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare(
    "SELECT DISTINCT date(timestamp / 1000, 'unixepoch', 'localtime') AS day FROM sessions ORDER BY day DESC"
  ).all();

  const days = rows.map(r => r.day);
  if (!days.length) {
    return res.json({ currentStreak: 0, longestStreak: 0, trainedToday: false, lastTrainingDate: null });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const trainedToday = days[0] === todayStr;

  const toDate = (s) => new Date(s + 'T00:00:00');
  const diffDays = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);

  let currentStreak = 0;
  let startFrom = trainedToday ? todayStr : (() => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return y.toISOString().slice(0, 10);
  })();

  for (const day of days) {
    const gap = diffDays(startFrom, day);
    if (gap === 0) {
      currentStreak++;
      const prev = toDate(day);
      prev.setDate(prev.getDate() - 1);
      startFrom = prev.toISOString().slice(0, 10);
    } else if (gap > 0) {
      break;
    }
  }

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (diffDays(days[i - 1], days[i]) === 1) {
      run++;
    } else {
      longestStreak = Math.max(longestStreak, run);
      run = 1;
    }
  }
  longestStreak = Math.max(longestStreak, run);

  res.json({
    currentStreak,
    longestStreak,
    trainedToday,
    lastTrainingDate: days[0],
  });
});

module.exports = router;
