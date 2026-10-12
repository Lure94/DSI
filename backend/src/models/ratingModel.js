'use strict';

/** MODELO MVC: calificaciones de 1 a 5 estrellas. */
function upsert(db, userId, movieId, value) {
  db.prepare(`
    INSERT INTO ratings(user_id,movie_id,value)
    VALUES (?,?,?)
    ON CONFLICT(user_id,movie_id) DO UPDATE SET value=excluded.value
  `).run(userId, movieId, value);
}

function summary(db, movieId) {
  return db
    .prepare('SELECT ROUND(AVG(value),1) AS avg,COUNT(*) AS count FROM ratings WHERE movie_id=?')
    .get(movieId);
}

function findUserRating(db, userId, movieId) {
  return (
    db.prepare('SELECT value FROM ratings WHERE movie_id=? AND user_id=?').get(movieId, userId)
      ?.value ?? null
  );
}

module.exports = { upsert, summary, findUserRating };
