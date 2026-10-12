'use strict';

/**
 * MODELO MVC: Usuario y sesión.
 * Encapsula consultas SQL relacionadas con usuarios, sesiones y recuperación.
 */
function findByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email=?').get(email);
}

function findById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}

function create(db, { name, email, passwordHash, role = 'user' }) {
  const result = db
    .prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)')
    .run(name, email, passwordHash, role);
  return Number(result.lastInsertRowid);
}

function countAdmins(db) {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM users WHERE role=?').get('admin').n);
}

function list(db) {
  return db
    .prepare('SELECT id,name,email,role,created_at AS createdAt FROM users ORDER BY id DESC')
    .all();
}

function remove(db, id) {
  return db.prepare('DELETE FROM users WHERE id=?').run(id).changes;
}

function updatePassword(db, id, passwordHash) {
  return db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, id).changes;
}

function createSession(db, tokenHash, userId, expiresAt) {
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(tokenHash, userId, expiresAt);
}

function findBySession(db, tokenHash, now) {
  return db
    .prepare(`
      SELECT users.*
      FROM sessions
      JOIN users ON users.id=sessions.user_id
      WHERE sessions.token_hash=? AND sessions.expires_at>?
    `)
    .get(tokenHash, now);
}

function deleteSession(db, tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
}

function deleteSessionsByUser(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
}

function createResetToken(db, tokenHash, userId, expiresAt) {
  db.prepare('INSERT INTO reset_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(tokenHash, userId, expiresAt);
}

function findResetToken(db, tokenHash, now) {
  return db
    .prepare('SELECT user_id FROM reset_tokens WHERE token_hash=? AND expires_at>?')
    .get(tokenHash, now);
}

function deleteResetTokensByUser(db, userId) {
  db.prepare('DELETE FROM reset_tokens WHERE user_id=?').run(userId);
}

module.exports = {
  findByEmail,
  findById,
  create,
  countAdmins,
  list,
  remove,
  updatePassword,
  createSession,
  findBySession,
  deleteSession,
  deleteSessionsByUser,
  createResetToken,
  findResetToken,
  deleteResetTokensByUser,
};
