'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Frontend películas: inicio, catálogo, detalle y calificaciones consumen el backend', () => {
  const home = read('index.html');
  const peliculas = read('peliculas.html');
  const detalle = read('detalle.html');
  const movieApi = read('assets/js/movie-api.js');
  const catalog = read('assets/js/pages/catalog.js');

  assert.match(home, /data-page="home"/);
  assert.match(peliculas, /data-page="movies"/);
  assert.match(detalle, /data-page="detail"/);
  assert.match(movieApi, /api\(`\/movies\?page=/);
  assert.match(movieApi, /api\(`\/movies\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(catalog, /\/ratings/);
  assert.match(catalog, /\/reviews\?movieId=/);
  assert.match(catalog, /method:'POST'/);
});
