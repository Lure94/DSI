'use strict';

/**
 * SERVICIO de películas - primera etapa del módulo de Laureano.
 *
 * Arquitectura Cliente-Servidor:
 * - El token TMDB permanece en el backend.
 * - El frontend solo consumirá los endpoints /api/movies.
 * - En este commit todavía no se mezcla la calificación comunitaria;
 *   esa mejora se incorpora en el Commit 3.
 */
const { fail } = require('../utils/http');
const movieModel = require('../models/movieModel');

const GENRE_NAMES = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen',
  99: 'Documental', 18: 'Drama', 10751: 'Familiar', 14: 'Fantasía', 36: 'Historia',
  27: 'Terror', 10402: 'Música', 9648: 'Misterio', 10749: 'Romance',
  878: 'Ciencia ficción', 10770: 'TV', 53: 'Suspenso', 10752: 'Guerra', 37: 'Western',
};

const memCache = new Map();

function cacheGet(key) {
  const item = memCache.get(key);
  return item && item.until > Date.now() ? item.value : null;
}

function cacheSet(key, value, minutes = 10) {
  if (memCache.size > 100) memCache.clear();
  memCache.set(key, { value, until: Date.now() + minutes * 60_000 });
}

async function externalJSON(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(5_500),
  });
  if (!response.ok) throw fail(502, `El proveedor de películas respondió ${response.status}.`);
  return response.json();
}

function mapTMDB(movie) {
  const year = Number(String(movie.release_date || '').slice(0, 4)) || null;
  const namedGenres = (movie.genres || []).map((genre) => genre.name);
  const genre = namedGenres.length
    ? namedGenres.join(', ')
    : (movie.genre_ids || []).map((id) => GENRE_NAMES[id]).filter(Boolean).join(', ');

  return {
    id: `tmdb-${movie.id}`,
    source: 'TMDB',
    title: movie.title || movie.original_title || 'Sin título',
    year,
    genre: genre || 'Otros',
    poster: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : 'assets/img/poster-no-disponible.svg',
    synopsis: movie.overview || 'Sin sinopsis disponible.',
    minutes: movie.runtime || null,
    sourceUrl: `https://www.themoviedb.org/movie/${movie.id}`,
  };
}

function mapApple(movie) {
  const poster = String(movie.artworkUrl100 || '')
    .replace(/\d+x\d+bb/g, '600x900bb')
    .replace(/100x100/g, '600x900');

  return {
    id: `apple-${movie.trackId}`,
    source: 'Apple TV / iTunes',
    title: movie.trackName || 'Sin título',
    year: Number(String(movie.releaseDate || '').slice(0, 4)) || null,
    genre: movie.primaryGenreName || 'Otros',
    poster: poster || 'assets/img/poster-no-disponible.svg',
    synopsis: movie.longDescription || movie.shortDescription || 'Sin sinopsis disponible.',
    minutes: movie.trackTimeMillis ? Math.round(movie.trackTimeMillis / 60_000) : null,
    sourceUrl: movie.trackViewUrl || null,
  };
}

function persistMovies(db, films) {
  movieModel.upsertMany(db, films);
}

function dbRow(row) {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    year: row.year,
    genre: row.genre,
    poster: row.poster,
    synopsis: row.synopsis,
    minutes: row.minutes,
    sourceUrl: row.source_url,
  };
}

function sourceName(env) {
  return env.TMDB_READ_TOKEN ? 'TMDB' : 'Apple TV / iTunes';
}

async function searchApple(term) {
  const params = new URLSearchParams({
    term,
    media: 'movie',
    entity: 'movie',
    limit: '60',
    country: 'us',
  });

  const json = await externalJSON(`https://itunes.apple.com/search?${params}`);
  return (json.results || [])
    .filter((movie) => movie.trackId && movie.trackName && (movie.kind === 'feature-movie' || movie.wrapperType === 'track'))
    .map(mapApple);
}

async function catalogFromApple(term, pageNum) {
  if (term) return searchApple(term);

  const terms = pageNum === 1 ? ['love', 'world', 'adventure'] : ['war', 'family', 'mystery'];
  const responses = await Promise.allSettled(terms.map(searchApple));
  const items = new Map();

  for (const result of responses) {
    if (result.status !== 'fulfilled') continue;
    for (const movie of result.value) items.set(movie.id, movie);
  }

  if (!items.size) {
    const failed = responses.filter((result) => result.status === 'rejected');
    if (failed.length === responses.length) throw failed[0].reason;
  }

  return [...items.values()];
}

async function popular(db, env, { query = '', page = 1 } = {}) {
  const term = String(query || '').trim().slice(0, 90);
  const pageNum = Math.min(5, Math.max(1, Number(page) || 1));
  const key = `films:${env.TMDB_READ_TOKEN ? 'tmdb' : 'apple'}:${term}:${pageNum}`;
  const stored = cacheGet(key);

  if (stored) return { items: stored, source: sourceName(env), cached: true };

  let items;
  try {
    if (env.TMDB_READ_TOKEN) {
      const endpoint = term ? 'search/movie' : 'movie/popular';
      const params = new URLSearchParams({
        language: 'es-ES',
        page: String(pageNum),
        include_adult: 'false',
      });
      if (term) params.set('query', term);

      const json = await externalJSON(
        `https://api.themoviedb.org/3/${endpoint}?${params}`,
        { Authorization: `Bearer ${env.TMDB_READ_TOKEN}` },
      );
      items = (json.results || []).filter((movie) => movie.id && movie.title).map(mapTMDB);
    } else {
      items = await catalogFromApple(term, pageNum);
    }

    if (!items.length && !term) {
      throw fail(502, 'La API respondió sin películas para las consultas del catálogo.');
    }

    persistMovies(db, items);
    if (items.length || term) cacheSet(key, items);
    return { items, source: sourceName(env), cached: false };
  } catch (error) {
    const rows = movieModel.search(db, term);
    if (rows.length) {
      return {
        items: rows.map(dbRow),
        source: sourceName(env),
        cached: true,
        warning: 'Proveedor externo no disponible; datos reales previamente consultados.',
      };
    }

    const details = error?.message ? ` Detalle: ${error.message}` : '';
    throw fail(
      502,
      `No se pudieron obtener películas de ${sourceName(env)}. Comprueba Internet y, si persiste, configura TMDB_READ_TOKEN en backend/.env.${details}`,
    );
  }
}

async function getMovie(db, env, id) {
  if (!/^(apple|tmdb)-\d+$/.test(id)) {
    throw fail(400, 'Identificador de película inválido.');
  }

  const local = movieModel.findById(db, id);
  const cacheIsFresh = local && Date.now() - local.updated_at < 24 * 60 * 60 * 1000;
  if (cacheIsFresh && (local.minutes || id.startsWith('apple-'))) return dbRow(local);

  try {
    let movie;
    if (id.startsWith('tmdb-')) {
      if (!env.TMDB_READ_TOKEN) {
        if (local) return dbRow(local);
        throw fail(503, 'Debes configurar TMDB_READ_TOKEN para esta ficha.');
      }

      const json = await externalJSON(
        `https://api.themoviedb.org/3/movie/${id.slice(5)}?language=es-ES`,
        { Authorization: `Bearer ${env.TMDB_READ_TOKEN}` },
      );
      movie = mapTMDB(json);
    } else {
      const json = await externalJSON(
        `https://itunes.apple.com/lookup?id=${id.slice(6)}&entity=movie&country=us`,
      );
      if (!json.results?.[0]) throw fail(404, 'Película no encontrada en Apple.');
      movie = mapApple(json.results[0]);
    }

    persistMovies(db, [movie]);
    return movie;
  } catch (error) {
    if (local) return dbRow(local);
    throw fail(error.status || 502, error.message || 'No se pudo recuperar la película.');
  }
}

module.exports = { popular, getMovie, sourceName, persistMovies, GENRE_NAMES };
