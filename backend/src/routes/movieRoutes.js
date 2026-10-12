'use strict';

/**
 * Ruta temporal de salud para la estructura inicial.
 * Laureano reemplazará este archivo al integrar el catálogo de películas.
 */
async function movieRoutes(ctx) {
  if (ctx.url.pathname === '/api/health' && ctx.req.method === 'GET') {
    ctx.send(200, {
      status: 'ok',
      database: 'sqlite',
      catalog: 'pendiente',
      backend: 'estructura MVC inicial',
    });
    return true;
  }

  return false;
}

module.exports = movieRoutes;
