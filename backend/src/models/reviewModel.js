'use strict';

/** MODELO MVC: reseñas publicadas por los usuarios. */
const SELECT_REVIEW = `
  SELECT
    r.id,
    r.user_id AS userId,
    r.movie_id AS movieId,
    r.text,
    r.status,
    r.created_at AS date,
    r.updated_at AS updated,
    u.name AS author,
    COALESCE(a.value,0) AS rating,
    m.title AS movieTitle,
    m.genre AS movieGenre,
    m.poster AS moviePoster,
    m.year AS movieYear
  FROM reviews r
  JOIN users u ON u.id=r.user_id
  JOIN movies m ON m.id=r.movie_id
  LEFT JOIN ratings a ON a.movie_id=r.movie_id AND a.user_id=r.user_id
`;

/** Convierte columnas de película en un objeto movie más fácil de consumir por la Vista. */
function serialize(row) {
  if (!row) return row;

  const { movieTitle, movieGenre, moviePoster, movieYear, ...review } = row;
  return {
    ...review,
    movie: {
      id: review.movieId,
      title: movieTitle,
      genre: movieGenre,
      poster: moviePoster,
      year: movieYear,
    },
  };
}

function listVisible(db, movieId) {
  const where = movieId ? 'r.status=? AND r.movie_id=?' : 'r.status=?';
  const args = movieId ? ['visible', movieId] : ['visible'];

  return db
    .prepare(`${SELECT_REVIEW} WHERE ${where} ORDER BY r.created_at DESC,r.id DESC LIMIT 200`)
    .all(...args)
    .map(serialize);
}

function listByUser(db, userId) {
  return db
    .prepare(`${SELECT_REVIEW} WHERE r.user_id=? AND r.status='visible' ORDER BY r.created_at DESC,r.id DESC`)
    .all(userId)
    .map(serialize);
}

function existsForUserMovie(db, userId, movieId) {
  return Boolean(
    db.prepare('SELECT id FROM reviews WHERE user_id=? AND movie_id=?').get(userId, movieId),
  );
}

function create(db, userId, movieId, text) {
  const result = db
    .prepare('INSERT INTO reviews(user_id,movie_id,text) VALUES (?,?,?)')
    .run(userId, movieId, text);
  return Number(result.lastInsertRowid);
}

function getById(db, id) {
  return serialize(db.prepare(`${SELECT_REVIEW} WHERE r.id=?`).get(id));
}

function updateOwned(db, id, userId, text) {
  return db
    .prepare(`UPDATE reviews SET text=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND status='visible'`)
    .run(text, id, userId).changes;
}

function findOwned(db, id, userId) {
  return db.prepare('SELECT * FROM reviews WHERE id=? AND user_id=?').get(id, userId);
}

function removeOwned(db, id, userId) {
  return db.prepare('DELETE FROM reviews WHERE id=? AND user_id=?').run(id, userId).changes;
}

function findVisibleRaw(db, id) {
  return db.prepare('SELECT * FROM reviews WHERE id=? AND status=?').get(id, 'visible');
}

function markRemoved(db, id) {
  db.prepare('UPDATE reviews SET status=? WHERE id=?').run('removed', id);
}

module.exports = {
  serialize,
  listVisible,
  listByUser,
  existsForUserMovie,
  create,
  getById,
  updateOwned,
  findOwned,
  removeOwned,
  findVisibleRaw,
  markRemoved,
};
