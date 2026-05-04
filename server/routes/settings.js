const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const r of rows) result[r.key] = JSON.parse(r.value);
  res.json(result);
});

router.get('/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(row.value));
});

router.put('/:key', (req, res) => {
  const value = JSON.stringify(req.body);
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(req.params.key, value);
  res.json({ key: req.params.key, value: req.body });
});

module.exports = router;
