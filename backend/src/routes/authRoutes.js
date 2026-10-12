'use strict';

/**
 * RUTAS MVC: autenticación.
 * Esta capa reconoce URL + método HTTP y delega al authController.
 */
const authController = require('../controllers/authController');

async function authRoutes(ctx) {
  const path = ctx.url.pathname;
  const method = ctx.req.method;

  if (path === '/api/auth/register' && method === 'POST') {
    await authController.register(ctx);
  } else if (path === '/api/auth/login' && method === 'POST') {
    await authController.login(ctx);
  } else if (path === '/api/auth/me' && method === 'GET') {
    await authController.me(ctx);
  } else if (path === '/api/auth/logout' && method === 'POST') {
    await authController.logout(ctx);
  } else if (path === '/api/auth/recover' && method === 'POST') {
    await authController.recover(ctx);
  } else if (path === '/api/auth/reset' && method === 'POST') {
    await authController.reset(ctx);
  } else {
    return false;
  }

  return true;
}

module.exports = authRoutes;
