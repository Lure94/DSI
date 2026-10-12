'use strict';

/** CONTROLADOR MVC: CRUD de reseñas propias. */
const { requireUser } = require('../middleware/auth');
const { fail } = require('../utils/http');
const { transaction } = require('../config/database');
const reviews = require('../models/reviewModel');
const ratings = require('../models/ratingModel');
const movieService = require('../services/movieService');

async function ensureMovie(db, env, id) {
  if (!/^(apple|tmdb)-\d+$/.test(id)) {
    throw fail(400, 'Selecciona una película válida.');
  }
  await movieService.getMovie(db, env, id);
}

/** GET /api/reviews */
async function list(ctx) {
  const movieId = ctx.url.searchParams.get('movieId');
  ctx.send(200, { items: reviews.listVisible(ctx.db, movieId) });
}

/** GET /api/reviews/mine */
async function mine(ctx) {
  const user = requireUser(ctx);
  ctx.send(200, { items: reviews.listByUser(ctx.db, user.id) });
}

/** POST /api/reviews */
async function create(ctx) {
  const user = requireUser(ctx);
  const body = await ctx.json();
  const movieId = String(body.movieId || '');
  const text = String(body.text || '').trim();
  const rating = Number(body.rating);

  if (
    text.length < 10 ||
    text.length > 1200 ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw fail(400, 'La reseña debe tener 10-1200 caracteres y 1-5 estrellas.');
  }

  await ensureMovie(ctx.db, ctx.env, movieId);

  if (reviews.existsForUserMovie(ctx.db, user.id, movieId)) {
    throw fail(
      409,
      'Ya publicaste una reseña para esta película. Puedes editarla en Mis reseñas.',
    );
  }

  let id;
  transaction(ctx.db, () => {
    id = reviews.create(ctx.db, user.id, movieId, text);
    ratings.upsert(ctx.db, user.id, movieId, rating);
  });

  ctx.send(201, { review: reviews.getById(ctx.db, id) });
}

/** PUT /api/reviews/:id */
async function update(ctx, id) {
  const user = requireUser(ctx);
  const body = await ctx.json();
  const text = String(body.text || '').trim();

  if (text.length < 10 || text.length > 1200) {
    throw fail(400, 'La reseña debe tener entre 10 y 1200 caracteres.');
  }

  if (!reviews.updateOwned(ctx.db, id, user.id, text)) {
    throw fail(404, 'Reseña no encontrada o no tienes permiso para modificarla.');
  }

  ctx.send(200, { review: reviews.getById(ctx.db, id) });
}

/** DELETE /api/reviews/:id */
async function remove(ctx, id) {
  const user = requireUser(ctx);

  if (!reviews.findOwned(ctx.db, id, user.id)) {
    throw fail(404, 'Reseña no encontrada o no tienes permiso para eliminarla.');
  }

  transaction(ctx.db, () => reviews.removeOwned(ctx.db, id, user.id));
  ctx.send(200, { message: 'Reseña eliminada.' });
}

module.exports = { list, mine, create, update, remove };
