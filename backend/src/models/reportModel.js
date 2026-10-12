'use strict';

/** MODELO MVC: reportes de reseñas. */
function exists(db, reviewId, reporterId) {
  return Boolean(
    db.prepare('SELECT id FROM reports WHERE review_id=? AND reporter_id=?').get(reviewId, reporterId),
  );
}

function create(db, reviewId, reporterId, reason, excerpt) {
  const result = db
    .prepare('INSERT INTO reports(review_id,reporter_id,reason,review_excerpt) VALUES(?,?,?,?)')
    .run(reviewId, reporterId, reason, excerpt);
  return Number(result.lastInsertRowid);
}

function list(db) {
  return db.prepare(`
    SELECT
      r.id,
      r.review_id AS reviewId,
      r.reason,
      r.review_excerpt AS reviewExcerpt,
      r.status,
      r.created_at AS date,
      u.name AS reporter
    FROM reports r
    JOIN users u ON u.id=r.reporter_id
    ORDER BY CASE WHEN r.status='pendiente' THEN 0 ELSE 1 END, r.id DESC
  `).all();
}

function findById(db, id) {
  return db.prepare('SELECT * FROM reports WHERE id=?').get(id);
}

function resolve(db, id, status) {
  db.prepare(`UPDATE reports SET status=?,resolved_at=datetime('now') WHERE id=?`).run(status, id);
}

function resolveAllForReview(db, reviewId) {
  db.prepare(`
    UPDATE reports
    SET status='retirada',resolved_at=datetime('now')
    WHERE review_id=? AND status='pendiente'
  `).run(reviewId);
}

module.exports = { exists, create, list, findById, resolve, resolveAllForReview };
