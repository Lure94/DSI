'use strict';

/** RUTAS MVC: reseñas. */
const reviewController = require('../controllers/reviewController');

async function reviewRoutes(ctx) {
  const path = ctx.url.pathname;
  const method = ctx.req.method;

  if (path === '/api/reviews' && method === 'GET') {
    await reviewController.list(ctx);
  } else if (path === '/api/reviews/mine' && method === 'GET') {
    await reviewController.mine(ctx);
  } else if (path === '/api/reviews' && method === 'POST') {
    await reviewController.create(ctx);
  } else {
    const match = /^\/api\/reviews\/(\d+)$/.exec(path);
    if (!match) return false;

    const reviewId = Number(match[1]);
    if (method === 'PUT') await reviewController.update(ctx, reviewId);
    else if (method === 'DELETE') await reviewController.remove(ctx, reviewId);
    else return false;
  }

  return true;
}

module.exports = reviewRoutes;
