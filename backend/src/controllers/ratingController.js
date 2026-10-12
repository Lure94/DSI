'use strict';

/** CONTROLADOR MVC: calificaciones de películas. */
const { requireUser } = require('../middleware/auth');
const { fail } = require('../utils/http');
const ratings = require('../models/ratingModel');
const movieService = require('../services/movieService');

/** POST /api/ratings */
async function save(ctx) {
  const user = requireUser(ctx);
  const body = await ctx.json();
  const rating = Number(body.rating);
  const movieId = String(body.movieId || '');

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw fail(400, 'Elige de 1 a 5 estrellas.');
  }
  if (!/^(apple|tmdb)-\d+$/.test(movieId)) {
    throw fail(400, 'Película inválida.');
  }

  // Asegura que la película exista en el catálogo/cache antes de relacionarla.
  await movieService.getMovie(ctx.db, ctx.env, movieId);
  ratings.upsert(ctx.db, user.id, movieId, rating);

  ctx.send(200, {
    rating,
    score: movieService.addScore(ctx.db, { id: movieId }),
  });
}

/** GET /api/ratings/:movieId */
async function summary(ctx, movieId) {
  const row = ratings.summary(ctx.db, movieId);
  const myRating = ctx.user
    ? ratings.findUserRating(ctx.db, ctx.user.id, movieId)
    : null;

  ctx.send(200, {
    avg: row.avg || null,
    count: row.count,
    myRating: myRating || null,
  });
}

module.exports = { save, summary };
