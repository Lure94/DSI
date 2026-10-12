'use strict';

/**
 * Middleware temporal de autenticación para la estructura inicial.
 *
 * MVC / Cliente-Servidor:
 * - La seguridad se aplica en el servidor, nunca solamente en la Vista.
 * - Fernando reemplazará estas funciones por la implementación real en su rama.
 */
function currentUser() {
  return null;
}

function requireUser() {
  throw Object.assign(new Error('Módulo de autenticación pendiente.'), { status: 401 });
}

function requireAdmin() {
  throw Object.assign(new Error('Módulo administrativo pendiente.'), { status: 403 });
}

function bootstrapAdmin() {
  // Se implementa en feature/backend-auth-fernando.
}

module.exports = { currentUser, requireUser, requireAdmin, bootstrapAdmin };
