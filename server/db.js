const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'brain-training.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    exercise TEXT NOT NULL,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_sessions_exercise ON sessions(exercise);
`);

module.exports = db;
