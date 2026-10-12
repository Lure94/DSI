'use strict';

/**
 * CONTROLADOR MVC: películas.
 * Recibe solicitudes del cliente y delega la obtención de datos al servicio de películas.
 */
const movieService = require('../services/movieService');

/** GET /api/health */
async function health(ctx) {
  ctx.send(200, {
    status: 'ok',
    database: 'sqlite',
    catalog: movieService.sourceName(ctx.env),
    frontend: 'CineReview',
  });
}

/** GET /api/movies */
async function list(ctx) {
  const query = ctx.url.searchParams.get('query');
  const page = ctx.url.searchParams.get('page');
  const result = await movieService.popular(ctx.db, ctx.env, { query, page });
  ctx.send(200, result);
}

/** GET /api/movies/:id */
async function detail(ctx, id) {
  const movie = await movieService.getMovie(ctx.db, ctx.env, id);
  ctx.send(200, { movie });
}

module.exports = { health, list, detail };
