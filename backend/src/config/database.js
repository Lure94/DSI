'use strict';

/**
 * Infraestructura de acceso a datos.
 *
 * En MVC los modelos utilizan esta conexión para persistir información.
 * El frontend no conoce ni manipula SQLite directamente.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/** Abre SQLite y crea las tablas necesarias si todavía no existen. */
function openDatabase(
  file = path.join(__dirname, '..', '..', 'data', 'cinereview.sqlite'),
) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      genre TEXT,
      poster TEXT,
      synopsis TEXT,
      minutes INTEGER,
      source_url TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id TEXT NOT NULL REFERENCES movies(id),
      text TEXT NOT NULL CHECK (length(text) BETWEEN 10 AND 1200),
      status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','removed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id TEXT NOT NULL REFERENCES movies(id),
      value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 5),
      PRIMARY KEY (user_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      review_excerpt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente'
        CHECK(status IN ('pendiente','descartado','retirada')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      UNIQUE(review_id, reporter_id)
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_movie ON reviews(movie_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings(movie_id);
  `);

  return db;
}

/** Ejecuta varias operaciones como una sola transacción. */
function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');

  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { openDatabase, transaction };
