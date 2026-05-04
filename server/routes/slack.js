const { Router } = require('express');
const db = require('../db');

const router = Router();

async function sendReminder() {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { sent: false, reason: 'no webhook configured' };

  const rows = db.prepare(
    "SELECT DISTINCT date(timestamp / 1000, 'unixepoch', 'localtime') AS day FROM sessions ORDER BY day DESC LIMIT 1"
  ).all();

  const todayStr = new Date().toISOString().slice(0, 10);
  const trainedToday = rows.length > 0 && rows[0].day === todayStr;

  if (trainedToday) return { sent: false, reason: 'already trained today' };

  const streakRows = db.prepare(
    "SELECT DISTINCT date(timestamp / 1000, 'unixepoch', 'localtime') AS day FROM sessions ORDER BY day DESC"
  ).all();
  const days = streakRows.map(r => r.day);
  let streak = 0;
  if (days.length) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let ref = yesterday.toISOString().slice(0, 10);
    for (const day of days) {
      if (day === ref) {
        streak++;
        const prev = new Date(day + 'T00:00:00');
        prev.setDate(prev.getDate() - 1);
        ref = prev.toISOString().slice(0, 10);
      } else break;
    }
  }

  const text = streak > 0
    ? `You haven't trained today. Your current streak is ${streak} day${streak !== 1 ? 's' : ''}. Don't break it!`
    : `You haven't trained today. Start a new streak!`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  return { sent: true, status: resp.status, streak };
}

router.post('/remind', async (req, res) => {
  try {
    const result = await sendReminder();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  res.json({
    configured: !!process.env.SLACK_WEBHOOK_URL,
    reminderHour: parseInt(process.env.SLACK_REMINDER_HOUR || '20', 10),
  });
});

module.exports = router;
module.exports.sendReminder = sendReminder;
