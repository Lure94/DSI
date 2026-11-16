'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Frontend autenticación: vistas, API REST y gestión de reseñas propias', () => {
  const login = read('login.html');
  const registro = read('registro.html');
  const recuperar = read('recuperar.html');
  const misResenas = read('mis-resenas.html');
  const api = read('assets/js/api.js');
  const accounts = read('assets/js/pages/accounts.js');

  assert.match(login, /data-page="login"/);
  assert.match(registro, /data-page="register"/);
  assert.match(recuperar, /data-page="recover"/);
  assert.match(misResenas, /data-page="my-reviews"/);

  assert.match(api, /\/auth\/login/);
  assert.match(api, /\/auth\/register/);
  assert.match(api, /Authorization/);
  assert.match(accounts, /\/auth\/recover/);
  assert.match(accounts, /\/auth\/reset/);
  assert.match(accounts, /\/reviews\/mine/);
  assert.match(accounts, /method:'PUT'/);
  assert.match(accounts, /method:'DELETE'/);
});
