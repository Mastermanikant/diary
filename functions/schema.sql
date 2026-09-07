-- FrankDiary Cloud Sync Schema in mmcentral-db
-- Database ID: c5a92a6e-b2b8-4d83-a814-2ff2c300f52a

CREATE TABLE IF NOT EXISTS frankdiary_vaults (
  vault_id TEXT PRIMARY KEY,
  salt_base64 TEXT NOT NULL,
  verifier_blob TEXT NOT NULL,
  device_name TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS frankdiary_entries (
  entry_id TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  vault_category TEXT DEFAULT 'personal',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  device_name TEXT NOT NULL,
  encrypted_nonce TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  preview_title TEXT,
  preview_mood TEXT,
  preview_is_favorite INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  PRIMARY KEY (vault_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_frankdiary_sync ON frankdiary_entries(vault_id, updated_at);
