'use strict';

/** Prueba automatizada de reseñas, reportes y administración. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('Comunidad: reseñas, reportes, moderación, usuarios y contacto', async () => {
  const app = await startTestApp({ seedMovie: true });

  try {
    const firstUser = await app.call(
      '/auth/register',
      {
        name: 'María Reseña',
        email: 'maria@test.local',
        password: 'passWord1234',
        terms: true,
      },
      'POST',
    );

    const secondUser = await app.call(
      '/auth/register',
      {
        name: 'Pedro Reporte',
        email: 'pedro@test.local',
        password: 'passWord1234',
        terms: true,
      },
      'POST',
    );

    const review = await app.call(
      '/reviews',
      {
        movieId: 'apple-999',
        rating: 5,
        text: 'Me gustó mucho esta historia y su fotografía.',
      },
      'POST',
      firstUser.data.token,
    );

    assert.equal(review.status, 201);
    const reviewId = review.data.review.id;

    const editOtherUser = await app.call(
      `/reviews/${reviewId}`,
      { text: 'No debería editar otra persona' },
      'PUT',
      secondUser.data.token,
    );
    assert.equal(editOtherUser.status, 404);

    const report = await app.call(
      '/reports',
      { reviewId, reason: 'Contenido inapropiado' },
      'POST',
      secondUser.data.token,
    );
    assert.equal(report.status, 201);

    assert.equal(
      (await app.call('/reports', undefined, 'GET', firstUser.data.token)).status,
      403,
    );

    const admin = await app.call(
      '/auth/login',
      { email: 'admin@test.local', password: 'AdminSecure123!' },
      'POST',
    );
    const adminToken = admin.data.token;

    assert.equal((await app.call('/reports', undefined, 'GET', adminToken)).data.items.length, 1);

    const moderation = await app.call(
      `/reports/${report.data.id}`,
      { action: 'retirada' },
      'PATCH',
      adminToken,
    );
    assert.equal(moderation.status, 200);
    assert.equal((await app.call('/reviews')).data.items.length, 0);

    const contact = await app.call(
      '/contact',
      {
        name: 'Ana Contacto',
        email: 'ana@test.local',
        subject: 'Consulta general',
        content: 'Este es un mensaje completo de prueba.',
      },
      'POST',
    );
    assert.equal(contact.status, 201);

    assert.equal((await app.call('/users', undefined, 'GET', adminToken)).data.items.length, 3);
    assert.equal(
      (await app.call(`/users/${firstUser.data.user.id}`, undefined, 'DELETE', adminToken)).status,
      200,
    );
  } finally {
    await app.close();
  }
});
