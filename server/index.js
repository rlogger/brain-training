require('dotenv').config();

const express = require('express');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 8090;

app.use(express.json({ limit: '5mb' }));

if (process.env.BT_API_TOKEN) {
  app.use('/api', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${process.env.BT_API_TOKEN}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  });
}

app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/streaks', require('./routes/streaks'));
app.use('/api/slack', require('./routes/slack'));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BrainTrainer running on http://localhost:${PORT}`);
});

const reminderHour = parseInt(process.env.SLACK_REMINDER_HOUR || '20', 10);
if (process.env.SLACK_WEBHOOK_URL) {
  cron.schedule(`0 ${reminderHour} * * *`, async () => {
    try {
      const { sendReminder } = require('./routes/slack');
      const result = await sendReminder();
      console.log('Slack reminder:', result);
    } catch (err) {
      console.error('Slack reminder error:', err.message);
    }
  });
  console.log(`Slack reminder scheduled daily at ${reminderHour}:00`);
}
