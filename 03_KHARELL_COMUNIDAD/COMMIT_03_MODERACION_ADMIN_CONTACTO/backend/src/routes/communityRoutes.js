'use strict';

/** RUTAS MVC: reportes, administración y contacto. */
const communityController = require('../controllers/communityController');

async function communityRoutes(ctx) {
  const path = ctx.url.pathname;
  const method = ctx.req.method;

  if (path === '/api/reports' && method === 'POST') {
    await communityController.createReport(ctx);
  } else if (path === '/api/reports' && method === 'GET') {
    await communityController.listReports(ctx);
  } else if (path === '/api/users' && method === 'GET') {
    await communityController.listUsers(ctx);
  } else if (path === '/api/contact' && method === 'POST') {
    await communityController.contact(ctx);
  } else {
    const reportMatch = /^\/api\/reports\/(\d+)$/.exec(path);
    if (reportMatch && method === 'PATCH') {
      await communityController.resolveReport(ctx, Number(reportMatch[1]));
      return true;
    }

    const userMatch = /^\/api\/users\/(\d+)$/.exec(path);
    if (userMatch && method === 'DELETE') {
      await communityController.deleteUser(ctx, Number(userMatch[1]));
      return true;
    }

    return false;
  }

  return true;
}

module.exports = communityRoutes;
