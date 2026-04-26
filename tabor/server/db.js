import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(join(DATA_DIR, 'tabor.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    filename TEXT NOT NULL,
    cover_color TEXT DEFAULT '#6366f1',
    total_pages INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 1,
    total_words INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_read TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    text TEXT NOT NULL,
    color TEXT DEFAULT 'yellow',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    book_id TEXT,
    book_title TEXT DEFAULT '',
    chapter INTEGER DEFAULT 0,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT 'ai',
    community_votes INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    pages_read INTEGER DEFAULT 0,
    start_page INTEGER DEFAULT 1,
    end_page INTEGER DEFAULT 1,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'timer',
    duration_minutes INTEGER DEFAULT 25,
    pages_goal INTEGER DEFAULT 0,
    flashcards_goal INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_knowledge (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    summary TEXT NOT NULL,
    key_concepts TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  INSERT OR IGNORE INTO user_profile (key, value) VALUES
    ('streak_days', '0'),
    ('last_study_date', ''),
    ('total_cards_reviewed', '0'),
    ('total_pages_read', '0'),
    ('daily_card_goal', '20'),
    ('focus_mode_enabled', 'false'),
    ('airlock_enabled', 'false'),
    ('airlock_cards_required', '10'),
    ('theme', 'dark');
`);

export default db;
