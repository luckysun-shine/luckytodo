import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.LUCKYTODO_DATA || path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'luckytodo.sqlite');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

fs.mkdirSync(path.join(MEDIA_DIR, 'avatars'), { recursive: true });
fs.mkdirSync(path.join(MEDIA_DIR, 'attachments'), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  agreed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  display_name TEXT NOT NULL,
  username TEXT,
  password_hash TEXT,
  user_id TEXT,
  role TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  avatar_media_id TEXT,
  avatar_updated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  member_id TEXT,
  family_id TEXT,
  user_id TEXT,
  device_name TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'adult',
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 20,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT,
  token TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, token)
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_entities_family_rev ON entities(family_id, revision);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(family_id, entity_type);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  rel_path TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  parent_type TEXT,
  parent_id TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

function tryAlter(sql) {
  try {
    db.exec(sql);
  } catch {
    /* column may already exist */
  }
}

tryAlter('ALTER TABLE members ADD COLUMN user_id TEXT');
tryAlter('ALTER TABLE sessions ADD COLUMN user_id TEXT');
tryAlter('ALTER TABLE sessions ADD COLUMN member_id TEXT');
tryAlter('ALTER TABLE sessions ADD COLUMN family_id TEXT');

function getRevision(familyId) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(`rev:${familyId}`);
  return row ? Number(row.value) : 0;
}

function nextRevision(familyId) {
  const current = getRevision(familyId);
  const next = current + 1;
  db.prepare(
    `INSERT INTO meta(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(`rev:${familyId}`, String(next));
  return next;
}

export { db, DATA_DIR, MEDIA_DIR, getRevision, nextRevision };
