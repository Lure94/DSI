'use strict';

/** Prueba automatizada del módulo de autenticación. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('Autenticación: registro, login, sesión, permisos y logout', async () => {
  const app = await startTestApp();

  try {
    assert.equal((await app.call('/health')).status, 200);

    const registered = await app.call(
      '/auth/register',
      {
        name: 'María Test',
        email: 'Maria@Test.local',
        password: 'passWord1234',
        terms: true,
      },
      'POST',
    );

    assert.equal(registered.status, 201);
    const token = registered.data.token;
    assert.ok(token.length > 40);

    const duplicate = await app.call(
      '/auth/register',
      {
        name: 'Otra',
        email: 'maria@test.local',
        password: 'passWord1234',
        terms: true,
      },
      'POST',
    );
    assert.equal(duplicate.status, 409);

    assert.equal((await app.call('/auth/me', undefined, 'GET', token)).status, 200);
    assert.equal((await app.call('/auth/me')).status, 401);

    const invalidLogin = await app.call(
      '/auth/login',
      { email: 'maria@test.local', password: 'incorrecta' },
      'POST',
    );
    assert.equal(invalidLogin.status, 401);

    const adminLogin = await app.call(
      '/auth/login',
      { email: 'admin@test.local', password: 'AdminSecure123!' },
      'POST',
    );
    assert.equal(adminLogin.status, 200);

    assert.equal((await app.call('/auth/logout', {}, 'POST', token)).status, 200);
    assert.equal((await app.call('/auth/me', undefined, 'GET', token)).status, 401);
  } finally {
    await app.close();
  }
});
