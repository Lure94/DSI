'use strict';

/**
 * CONTROLADOR MVC: autenticación.
 * Valida solicitudes HTTP y coordina el modelo de usuarios y el servicio de correo.
 */
const { randomBytes } = require('node:crypto');
const users = require('../models/userModel');
const {
  hashPassword,
  checkPassword,
  tokenHash,
  publicUser,
  newSession,
  requireUser,
} = require('../middleware/auth');
const { fail } = require('../utils/http');
const { sendResetMail } = require('../services/emailService');

const loginCount = new Map();
const emailIsValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 190;

/** Limita intentos de autenticación por IP para reducir abuso. */
function checkRate(req) {
  const ip = req.socket.remoteAddress || 'local';
  const now = Date.now();
  let record = loginCount.get(ip);

  if (!record || now - record.since > 15 * 60_000) {
    record = { since: now, count: 0 };
  }

  record.count += 1;
  loginCount.set(ip, record);

  if (record.count > 35) {
    throw fail(429, 'Demasiadas solicitudes de autenticación. Espera 15 minutos.');
  }
}

/** POST /api/auth/register */
async function register(ctx) {
  checkRate(ctx.req);
  const body = await ctx.json();

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (
    name.length < 3 ||
    name.length > 100 ||
    !emailIsValid(email) ||
    password.length < 8 ||
    password.length > 128 ||
    body.terms !== true
  ) {
    throw fail(400, 'Revisa nombre, correo, contraseña (8-128) y términos.');
  }

  if (users.findByEmail(ctx.db, email)) {
    throw fail(409, 'Este correo ya está registrado.');
  }

  const id = users.create(ctx.db, {
    name,
    email,
    passwordHash: hashPassword(password),
  });
  const user = publicUser(users.findById(ctx.db, id));

  ctx.send(201, { user, token: newSession(ctx.db, user.id) });
}

/** POST /api/auth/login */
async function login(ctx) {
  checkRate(ctx.req);
  const body = await ctx.json();
  const email = String(body.email || '').trim().toLowerCase();
  const user = users.findByEmail(ctx.db, email);

  // Hash ficticio para mantener un tiempo de comparación similar aunque el usuario no exista.
  const dummyHash = '0123456789abcdef0123456789abcdef:73494699f0bac1d97ad49d95a80cc73de84b413532e1bc77db30ad987d7fa68239b882643709507326721a4200ecf62d0d0d98ae7026211d2b68b27a8110';
  const passwordIsCorrect = checkPassword(
    String(body.password || ''),
    user?.password_hash || dummyHash,
  );

  if (!passwordIsCorrect || !user) {
    throw fail(401, 'Correo o contraseña incorrectos.');
  }

  ctx.send(200, {
    user: publicUser(user),
    token: newSession(ctx.db, user.id),
  });
}

/** GET /api/auth/me */
async function me(ctx) {
  ctx.send(200, { user: requireUser(ctx) });
}

/** POST /api/auth/logout */
async function logout(ctx) {
  const token = String(ctx.req.headers.authorization || '').replace(/^Bearer /, '');
  if (token) users.deleteSession(ctx.db, tokenHash(token));
  ctx.send(200, { message: 'Sesión cerrada.' });
}

/** POST /api/auth/recover */
async function recover(ctx) {
  checkRate(ctx.req);
  const body = await ctx.json();
  const email = String(body.email || '').trim().toLowerCase();

  if (!emailIsValid(email)) throw fail(400, 'Escribe un correo válido.');
  if (!ctx.env.RESEND_API_KEY || !ctx.env.EMAIL_FROM) {
    throw fail(
      503,
      'Para recuperar contraseñas configura RESEND_API_KEY y EMAIL_FROM en backend/.env.',
    );
  }

  const user = users.findByEmail(ctx.db, email);

  // La respuesta siempre es genérica para no revelar si un correo está registrado.
  if (user) {
    const token = randomBytes(32).toString('base64url');
    users.createResetToken(
      ctx.db,
      tokenHash(token),
      user.id,
      Date.now() + 20 * 60_000,
    );

    const publicUrl = ctx.env.PUBLIC_URL || 'http://localhost:3000';
    const link = `${publicUrl}/recuperar.html?token=${encodeURIComponent(token)}`;
    await sendResetMail(ctx.env, email, link);
  }

  ctx.send(200, { message: 'Si el correo existe, recibirás las instrucciones.' });
}

/** POST /api/auth/reset */
async function reset(ctx) {
  const body = await ctx.json();
  const token = String(body.token || '');
  const password = String(body.password || '');

  if (token.length < 30 || password.length < 8 || password.length > 128) {
    throw fail(400, 'Token o contraseña inválidos.');
  }

  const resetRow = users.findResetToken(ctx.db, tokenHash(token), Date.now());
  if (!resetRow) throw fail(400, 'Enlace vencido o inválido.');

  // Cambio de contraseña, eliminación del token y cierre de sesiones en una transacción.
  ctx.db.exec('BEGIN');
  try {
    users.updatePassword(ctx.db, resetRow.user_id, hashPassword(password));
    users.deleteResetTokensByUser(ctx.db, resetRow.user_id);
    users.deleteSessionsByUser(ctx.db, resetRow.user_id);
    ctx.db.exec('COMMIT');
  } catch (error) {
    ctx.db.exec('ROLLBACK');
    throw error;
  }

  ctx.send(200, { message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
}

module.exports = { register, login, me, logout, recover, reset };
