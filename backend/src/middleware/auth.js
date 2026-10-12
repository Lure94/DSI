'use strict';

/**
 * Middleware de seguridad del servidor.
 * La autenticación y autorización se validan en backend, como exige Cliente-Servidor.
 */
const {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} = require('node:crypto');

const users = require('../models/userModel');

/** Convierte un token de sesión en un hash antes de almacenarlo. */
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

/** Genera un hash seguro de contraseña usando scrypt y salt aleatorio. */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Compara una contraseña recibida con el hash guardado. */
function checkPassword(password, stored) {
  try {
    const [salt, hex] = stored.split(':');
    const supplied = scryptSync(password, salt, 64);
    const expected = Buffer.from(hex, 'hex');

    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}

/** Evita devolver campos sensibles como password_hash. */
function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Crea una sesión con vigencia de siete días. */
function newSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  users.createSession(db, tokenHash(token), userId, expiresAt);
  return token;
}

/** Obtiene al usuario autenticado a partir del encabezado Authorization. */
function currentUser(db, req) {
  const value = req.headers.authorization || '';
  const match = /^Bearer ([a-zA-Z0-9_-]{30,})$/.exec(value);
  if (!match) return null;

  return publicUser(users.findBySession(db, tokenHash(match[1]), Date.now()));
}

/** Protege endpoints que requieren una sesión válida. */
function requireUser(ctx) {
  if (!ctx.user) {
    throw Object.assign(new Error('Debes iniciar sesión.'), { status: 401 });
  }
  return ctx.user;
}

/** Protege endpoints exclusivos del administrador. */
function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Permiso exclusivo del administrador.'), { status: 403 });
  }
  return user;
}

/** Crea la primera cuenta administradora usando variables del .env. */
function bootstrapAdmin(db, env) {
  const noAdminExists = !users.countAdmins(db);
  const credentialsConfigured = env.ADMIN_EMAIL && env.ADMIN_PASSWORD;

  if (!noAdminExists || !credentialsConfigured) return;
  if (env.ADMIN_PASSWORD.length < 10) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres.');
  }

  users.create(db, {
    name: env.ADMIN_NAME || 'Administrador CineReview',
    email: env.ADMIN_EMAIL.toLowerCase().trim(),
    passwordHash: hashPassword(env.ADMIN_PASSWORD),
    role: 'admin',
  });

  console.log('Cuenta administradora inicial creada:', env.ADMIN_EMAIL);
}

module.exports = {
  hashPassword,
  checkPassword,
  publicUser,
  tokenHash,
  newSession,
  currentUser,
  requireUser,
  requireAdmin,
  bootstrapAdmin,
};
