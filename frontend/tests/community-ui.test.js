'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Frontend comunidad: reseñas, contacto, moderación y usuarios usan la API del servidor', () => {
  const resenas = read('resenas.html');
  const contacto = read('contacto.html');
  const admin = read('admin.html');
  const terminos = read('terminos.html');
  const community = read('assets/js/pages/community.js');

  assert.match(resenas, /data-page="reviews"/);
  assert.match(contacto, /data-page="contact"/);
  assert.match(admin, /data-page="admin"/);
  assert.match(terminos, /data-page="terms"/);
  assert.match(community, /api\('\/reviews'\)/);
  assert.match(community, /api\('\/reports'\)/);
  assert.match(community, /api\('\/users'\)/);
  assert.match(community, /api\('\/contact'/);
  assert.match(community, /method:'PATCH'/);
  assert.match(community, /method:'DELETE'/);
});
