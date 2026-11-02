const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const path = require('path');
const schema = require('./schema');

// Database file path
const dbPath = path.resolve(__dirname, '../../tasklab.db');
const sqlite = new Database(dbPath);

// Enable WAL mode & foreign keys for optimal performance and data integrity
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Initialize Drizzle ORM
const db = drizzle(sqlite, { schema });

// Auto-create tables if they don't exist
function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      major TEXT DEFAULT 'Teknik Informatika',
      semester TEXT DEFAULT 'Semester 4',
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      course TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      deadline_text TEXT,
      urgency TEXT NOT NULL DEFAULT 'warning',
      urgency_label TEXT NOT NULL DEFAULT '🟡 H-3 Waspada',
      badge_class TEXT NOT NULL DEFAULT 'badge-warning',
      links TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      note TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS labs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      course TEXT NOT NULL,
      time TEXT NOT NULL,
      room TEXT NOT NULL,
      assistant TEXT,
      link TEXT,
      attended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

initDb();

module.exports = {
  db,
  sqlite,
  schema
};

