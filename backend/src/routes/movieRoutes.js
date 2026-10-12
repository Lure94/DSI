'use strict';

/**
 * RUTAS MVC: películas.
 * Las rutas no consultan TMDB directamente; delegan esa responsabilidad al controlador/servicio.
 */
const movieController = require('../controllers/movieController');

async function movieRoutes(ctx) {
  const path = ctx.url.pathname;
  const method = ctx.req.method;

  if (path === '/api/health' && method === 'GET') {
    await movieController.health(ctx);
  } else if (path === '/api/movies' && method === 'GET') {
    await movieController.list(ctx);
  } else {
    const match = /^\/api\/movies\/((?:apple|tmdb)-\d+)$/.exec(path);
    if (!match || method !== 'GET') return false;
    await movieController.detail(ctx, match[1]);
  }

  return true;
}

module.exports = movieRoutes;
