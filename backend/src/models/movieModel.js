'use strict';

/**
 * MODELO MVC: Película.
 * Conserva en SQLite las fichas reales recuperadas desde TMDB/Apple para caché y relaciones.
 */
function upsertMany(db, films) {
  const statement = db.prepare(`
    INSERT INTO movies(id,source,title,year,genre,poster,synopsis,minutes,source_url,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      year=excluded.year,
      genre=excluded.genre,
      poster=excluded.poster,
      synopsis=excluded.synopsis,
      minutes=excluded.minutes,
      source_url=excluded.source_url,
      updated_at=excluded.updated_at
  `);

  for (const movie of films) {
    statement.run(
      movie.id,
      movie.source,
      movie.title,
      movie.year,
      movie.genre,
      movie.poster,
      movie.synopsis,
      movie.minutes,
      movie.sourceUrl,
      Date.now(),
    );
  }
}

function findById(db, id) {
  return db.prepare('SELECT * FROM movies WHERE id=?').get(id);
}

function search(db, term) {
  const safeTerm = term.replace(/[%_]/g, '');
  return db
    .prepare('SELECT * FROM movies WHERE title LIKE ? ORDER BY updated_at DESC LIMIT 60')
    .all(`%${safeTerm}%`);
}

module.exports = { upsertMany, findById, search };
