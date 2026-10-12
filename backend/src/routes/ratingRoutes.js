'use strict';

/** RUTAS MVC: calificaciones. */
const ratingController = require('../controllers/ratingController');

async function ratingRoutes(ctx) {
  const path = ctx.url.pathname;
  const method = ctx.req.method;

  if (path === '/api/ratings' && method === 'POST') {
    await ratingController.save(ctx);
  } else {
    const match = /^\/api\/ratings\/((?:tmdb|apple)-\d+)$/.exec(path);
    if (!match || method !== 'GET') return false;
    await ratingController.summary(ctx, match[1]);
  }

  return true;
}

module.exports = ratingRoutes;
