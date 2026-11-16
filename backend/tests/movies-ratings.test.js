'use strict';

/** Prueba automatizada de catálogo y calificaciones. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('Películas y calificaciones: proveedor externo, catálogo, detalle y promedio', async () => {
  const originalFetch = global.fetch;
  let apiCalls = 0;

  // Simula únicamente la API externa; las llamadas al servidor local siguen siendo reales.
  global.fetch = async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1')) {
      return originalFetch(url, options);
    }

    apiCalls += 1;
    return {
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            kind: 'feature-movie',
            trackName: 'Película devuelta por API',
            primaryGenreName: 'Acción',
            artworkUrl100: 'https://example.com/100x100bb.jpg',
            releaseDate: '2026-01-01T10:00:00Z',
            longDescription: 'Sinopsis de la API',
            trackTimeMillis: 5_400_000,
            trackViewUrl: 'https://itunes.apple.com/movie',
          },
        ],
      }),
    };
  };

  const app = await startTestApp({ admin: false });

  try {
    const catalog = await app.call('/movies');
    assert.equal(catalog.status, 200);
    assert.equal(catalog.data.items[0].source, 'Apple TV / iTunes');
    assert.ok(apiCalls > 0);

    const userResponse = await app.call(
      '/auth/register',
      {
        name: 'Usuario Películas',
        email: 'movies@test.local',
        password: 'passWord1234',
        terms: true,
      },
      'POST',
    );
    const token = userResponse.data.token;

    const invalidRating = await app.call(
      '/ratings',
      { movieId: 'apple-123', rating: 7 },
      'POST',
      token,
    );
    assert.equal(invalidRating.status, 400);

    const validRating = await app.call(
      '/ratings',
      { movieId: 'apple-123', rating: 4 },
      'POST',
      token,
    );
    assert.equal(validRating.status, 200);

    const score = await app.call('/ratings/apple-123');
    assert.equal(score.data.avg, 4);
    assert.equal(score.data.count, 1);

    const detail = await app.call('/movies/apple-123');
    assert.equal(detail.status, 200);
    assert.equal(detail.data.movie.title, 'Película devuelta por API');
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
});
