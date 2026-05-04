const { Router } = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { exercise, limit = 500, offset = 0 } = req.query;
  let sql = 'SELECT data FROM sessions';
  const params = [];
  if (exercise) {
    sql += ' WHERE exercise = ?';
    params.push(exercise);
  }
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => JSON.parse(r.data)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT data FROM sessions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(row.data));
});

router.post('/', (req, res) => {
  const record = req.body;
  if (!record.id) record.id = crypto.randomUUID();
  if (!record.timestamp) record.timestamp = Date.now();
  if (!record.exercise) return res.status(400).json({ error: 'exercise field required' });

  db.prepare('INSERT OR REPLACE INTO sessions (id, exercise, data, timestamp) VALUES (?, ?, ?, ?)')
    .run(record.id, record.exercise, JSON.stringify(record), record.timestamp);
  res.status(201).json(record);
});

router.post('/import', (req, res) => {
  const { sessions } = req.body;
  if (!Array.isArray(sessions)) return res.status(400).json({ error: 'sessions array required' });

  const insert = db.prepare('INSERT OR IGNORE INTO sessions (id, exercise, data, timestamp) VALUES (?, ?, ?, ?)');
  const tx = db.transaction((items) => {
    let imported = 0;
    for (const s of items) {
      if (!s.id || !s.exercise) continue;
      const result = insert.run(s.id, s.exercise, JSON.stringify(s), s.timestamp || Date.now());
      if (result.changes > 0) imported++;
    }
    return imported;
  });

  const imported = tx(sessions);
  res.json({ imported, total: sessions.length });
});

router.delete('/', (req, res) => {
  if (req.query.confirm !== 'true') return res.status(400).json({ error: 'pass ?confirm=true' });
  const info = db.prepare('DELETE FROM sessions').run();
  res.json({ deleted: info.changes });
});

module.exports = router;
