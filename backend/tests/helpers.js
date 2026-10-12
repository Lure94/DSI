'use strict';

/** Utilidades compartidas por las pruebas del backend. */
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { openDatabase } = require('../src/config/database');
const { hashPassword } = require('../src/middleware/auth');

const sampleMovie = {
  id: 'apple-999',
  source: 'Apple TV / iTunes',
  title: 'Pelicula API simulada',
  year: 2025,
  genre: 'Drama',
  poster: 'https://example.com/poster.jpg',
  synopsis: 'Sinopsis externa de prueba',
  minutes: 120,
  sourceUrl: 'https://itunes.apple.com/',
};

async function startTestApp({ seedMovie = false, admin = true, env = { TMDB_READ_TOKEN: '' } } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cinereview-test-'));
  const file = path.join(dir, 'db.sqlite');
  const db = openDatabase(file);

  if (seedMovie) {
    const { persistMovies } = require('../src/services/movieService');
    persistMovies(db, [sampleMovie]);
  }

  if (admin) {
    db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run(
      'Admin real',
      'admin@test.local',
      hashPassword('AdminSecure123!'),
      'admin',
    );
  }

  const { server } = createApp({ db, env, bootstrap: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(route, body, method = 'GET', token) {
    const response = await fetch(base + '/api' + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return { status: response.status, data: await response.json() };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    try { db.close(); } catch {}
    rmSync(dir, { recursive: true, force: true });
  }

  return { dir, file, db, server, base, call, close };
}

module.exports = { startTestApp, sampleMovie };
