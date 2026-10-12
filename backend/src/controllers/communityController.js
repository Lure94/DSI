'use strict';

/**
 * CONTROLADOR MVC: comunidad y administración.
 * Gestiona reportes, moderación, usuarios administrativos y contacto.
 */
const { requireUser, requireAdmin } = require('../middleware/auth');
const { transaction } = require('../config/database');
const { fail } = require('../utils/http');
const reviews = require('../models/reviewModel');
const reports = require('../models/reportModel');
const users = require('../models/userModel');
const contacts = require('../models/contactModel');

/** POST /api/reports */
async function createReport(ctx) {
  const user = requireUser(ctx);
  const body = await ctx.json();
  const reviewId = Number(body.reviewId);
  const reason = String(body.reason || '').trim();

  if (!Number.isInteger(reviewId) || reason.length < 3 || reason.length > 200) {
    throw fail(400, 'Reporte inválido.');
  }

  const review = reviews.findVisibleRaw(ctx.db, reviewId);
  if (!review) throw fail(404, 'La reseña no existe o ya fue retirada.');
  if (review.user_id === user.id) throw fail(400, 'No puedes reportar tu propia reseña.');
  if (reports.exists(ctx.db, reviewId, user.id)) throw fail(409, 'Ya reportaste esta reseña.');

  const id = reports.create(ctx.db, reviewId, user.id, reason, review.text);
  ctx.send(201, { id, status: 'pendiente' });
}

/** GET /api/reports - solo administrador. */
async function listReports(ctx) {
  requireAdmin(ctx);
  ctx.send(200, { items: reports.list(ctx.db) });
}

/** PATCH /api/reports/:id - solo administrador. */
async function resolveReport(ctx, id) {
  requireAdmin(ctx);
  const body = await ctx.json();
  const status = String(body.action || '');

  if (!['descartado', 'retirada'].includes(status)) {
    throw fail(400, 'Elige descartado o retirada.');
  }

  const report = reports.findById(ctx.db, id);
  if (!report) throw fail(404, 'Reporte no encontrado.');
  if (report.status !== 'pendiente') throw fail(409, 'Este reporte ya fue resuelto.');

  transaction(ctx.db, () => {
    if (status === 'retirada' && report.review_id) {
      reviews.markRemoved(ctx.db, report.review_id);
      reports.resolveAllForReview(ctx.db, report.review_id);
    } else {
      reports.resolve(ctx.db, report.id, status);
    }
  });

  ctx.send(200, {
    message: status === 'retirada' ? 'Reseña retirada.' : 'Reporte descartado.',
  });
}

/** GET /api/users - solo administrador. */
async function listUsers(ctx) {
  requireAdmin(ctx);
  ctx.send(200, { items: users.list(ctx.db) });
}

/** DELETE /api/users/:id - solo administrador. */
async function deleteUser(ctx, id) {
  const admin = requireAdmin(ctx);

  if (admin.id === id) {
    throw fail(400, 'No puedes eliminar tu propio perfil de administración.');
  }
  if (!users.findById(ctx.db, id)) throw fail(404, 'Perfil no encontrado.');

  users.remove(ctx.db, id);
  ctx.send(200, { message: 'Perfil eliminado y registros relacionados actualizados.' });
}

/** POST /api/contact */
async function contact(ctx) {
  const body = await ctx.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const subject = String(body.subject || '').trim();
  const content = String(body.content || '').trim();

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (
    name.length < 2 ||
    name.length > 100 ||
    !emailIsValid ||
    subject.length < 3 ||
    subject.length > 120 ||
    content.length < 10 ||
    content.length > 3000
  ) {
    throw fail(400, 'Revisa el formulario de contacto.');
  }

  const id = contacts.create(ctx.db, { name, email, subject, content });
  ctx.send(201, { id, message: 'Mensaje registrado para revisión.' });
}

module.exports = {
  createReport,
  listReports,
  resolveReport,
  listUsers,
  deleteUser,
  contact,
};
