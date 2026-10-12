'use strict';

/**
 * SERVICIO de películas.
 *
 * Arquitectura Cliente-Servidor:
 * - Solo el backend conoce TMDB_READ_TOKEN.
 * - El frontend consulta /api/movies y /api/movies/:id.
 * - TMDB es el proveedor principal y Apple/iTunes funciona como alternativa sin clave.
 * - No se precargan fichas inventadas: las películas provienen de APIs externas.
 */
const { fail } = require('../utils/http');
const movieModel = require('../models/movieModel');
const ratingModel = require('../models/ratingModel');
// Traduce identificadores de género de TMDB a nombres visibles.
const GENRE_NAMES = {28:'Acción',12:'Aventura',16:'Animación',35:'Comedia',80:'Crimen',99:'Documental',18:'Drama',10751:'Familiar',14:'Fantasía',36:'Historia',27:'Terror',10402:'Música',9648:'Misterio',10749:'Romance',878:'Ciencia ficción',10770:'TV',53:'Suspenso',10752:'Guerra',37:'Western'};
// Caché breve en memoria para reducir solicitudes repetidas al proveedor externo.
const memCache = new Map();
function cacheGet(key) { const item = memCache.get(key); return item && item.until > Date.now() ? item.value : null; }
function cacheSet(key,value,minutes=10) { if(memCache.size>100) memCache.clear();memCache.set(key,{value,until:Date.now()+minutes*60_000}); }
/** Ejecuta una solicitud externa con timeout y convierte la respuesta a JSON. */
async function externalJSON(url, headers={}) {
  const response = await fetch(url,{headers:{'Accept':'application/json',...headers},signal:AbortSignal.timeout(5_500)});
  if (!response.ok) throw fail(502, `El proveedor de películas respondió ${response.status}.`);
  return response.json();
}
/** Adapta una película de TMDB al formato interno de CineReview. */
function mapTMDB(movie) {
  const year=Number(String(movie.release_date || '').slice(0,4)) || null;
  const genres=(movie.genres || []).map(g=>g.name);
  const genre=genres.length ? genres.join(', ') : (movie.genre_ids || []).map(g=>GENRE_NAMES[g]).filter(Boolean).join(', ');
  return {id:`tmdb-${movie.id}`,source:'TMDB',title:movie.title || movie.original_title || 'Sin título',year,
    genre:genre || 'Otros',poster:movie.poster_path?`https://image.tmdb.org/t/p/w500${movie.poster_path}`:'assets/img/poster-no-disponible.svg',
    synopsis:movie.overview || 'Sin sinopsis disponible.',minutes:movie.runtime||null,
    sourceUrl:`https://www.themoviedb.org/movie/${movie.id}`};
}
/** Adapta una película de Apple/iTunes al mismo formato interno. */
function mapApple(movie) {
  const poster=String(movie.artworkUrl100 || '').replace(/\d+x\d+bb/g,'600x900bb').replace(/100x100/g,'600x900');
  return {id:`apple-${movie.trackId}`,source:'Apple TV / iTunes',title:movie.trackName || 'Sin título',
    year:Number(String(movie.releaseDate||'').slice(0,4)) || null,genre:movie.primaryGenreName || 'Otros',
    poster:poster || 'assets/img/poster-no-disponible.svg',synopsis:movie.longDescription || movie.shortDescription || 'Sin sinopsis disponible.',
    minutes:movie.trackTimeMillis ? Math.round(movie.trackTimeMillis/60_000):null,
    sourceUrl:movie.trackViewUrl || null};
}
function persistMovies(db, films) { movieModel.upsertMany(db, films); }
function addScore(db,movie) { const row=ratingModel.summary(db,movie.id); return {...movie,avgRating:row.avg || null,ratingCount:row.count || 0}; }
function dbRow(row) {
  return {id:row.id,source:row.source,title:row.title,year:row.year,genre:row.genre,poster:row.poster,
    synopsis:row.synopsis,minutes:row.minutes,sourceUrl:row.source_url};
}
function sourceName(env) { return env.TMDB_READ_TOKEN?'TMDB':'Apple TV / iTunes'; }
/** Apple no ofrece un endpoint de tendencias: consultamos términos generales y
 * usamos EXCLUSIVAMENTE los títulos y carteles que devuelva su API. */
async function searchApple(term) {
  const params=new URLSearchParams({term,media:'movie',entity:'movie',limit:'60',country:'us'});
  const json=await externalJSON(`https://itunes.apple.com/search?${params}`);
  return (json.results||[])
    .filter(m=>m.trackId && m.trackName && (m.kind==='feature-movie' || m.wrapperType==='track'))
    .map(mapApple);
}
async function catalogFromApple(term,pageNum) {
  if (term) return searchApple(term);
  // Son consultas de búsqueda, no películas ni fotografías precargadas.
  const terms=pageNum===1?['love','world','adventure']:['war','family','mystery'];
  const responses=await Promise.allSettled(terms.map(searchApple));
  const items=new Map();
  for (const result of responses) if (result.status==='fulfilled') {
    for (const movie of result.value) items.set(movie.id,movie);
  }
  if (!items.size) {
    const failed=responses.filter(r=>r.status==='rejected');
    if (failed.length===responses.length) throw failed[0].reason;
  }
  return [...items.values()];
}
/** Obtiene el catálogo/búsqueda y agrega la valoración interna de CineReview. */
async function popular(db,env,{query='',page=1}={}) {
  const term=String(query||'').trim().slice(0,90);
  const pageNum=Math.min(5,Math.max(1,Number(page)||1));
  const key=`films:${env.TMDB_READ_TOKEN?'tmdb':'apple'}:${term}:${pageNum}`;
  const stored=cacheGet(key);
  if (stored) return {items:stored.map(m=>addScore(db,m)),source:sourceName(env),cached:true};
  let items;
  try {
    if (env.TMDB_READ_TOKEN) {
      const endpoint=term?'search/movie':'movie/popular';
      const params=new URLSearchParams({language:'es-ES',page:String(pageNum),include_adult:'false'});
      if (term) params.set('query',term);
      const json=await externalJSON(`https://api.themoviedb.org/3/${endpoint}?${params}`,{'Authorization':`Bearer ${env.TMDB_READ_TOKEN}`});
      items=(json.results||[]).filter(m=>m.id && m.title).map(mapTMDB);
    } else {
      items=await catalogFromApple(term,pageNum);
    }
    if(!items.length && !term) throw fail(502,'La API respondió sin películas para las consultas del catálogo.');
    persistMovies(db,items);
    if(items.length || term) cacheSet(key,items);
    return {items:items.map(m=>addScore(db,m)),source:sourceName(env),cached:false};
  } catch (err) {
    const rows=movieModel.search(db,term);
    if (rows.length) return {items:rows.map(dbRow).map(m=>addScore(db,m)),source:sourceName(env),cached:true,warning:'Proveedor externo no disponible; datos reales previamente consultados.'};
    const details=err?.message ? ` Detalle: ${err.message}` : '';
    throw fail(502,`No se pudieron obtener películas de ${sourceName(env)}. Comprueba Internet y, si persiste, configura TMDB_READ_TOKEN en backend/.env.${details}`);
  }
}
/** Obtiene el detalle de una película desde caché local o desde el proveedor externo. */
async function getMovie(db,env,id) {
  if (!/^(apple|tmdb)-\d+$/.test(id)) throw fail(400,'Identificador de película inválido.');
  const local=movieModel.findById(db,id);
  if (local && (Date.now()-local.updated_at)<24*60*60*1000 && (local.minutes || id.startsWith('apple-'))) return addScore(db,dbRow(local));
  try {
    let m;
    if (id.startsWith('tmdb-')) {
      if (!env.TMDB_READ_TOKEN) {
        if (local) return addScore(db,dbRow(local));
        throw fail(503,'Debes configurar TMDB_READ_TOKEN para esta ficha.');
      }
      const json=await externalJSON(`https://api.themoviedb.org/3/movie/${id.slice(5)}?language=es-ES`,{'Authorization':`Bearer ${env.TMDB_READ_TOKEN}`});
      m=mapTMDB(json);
    } else {
      const json=await externalJSON(`https://itunes.apple.com/lookup?id=${id.slice(6)}&entity=movie&country=us`);
      if (!json.results?.[0]) throw fail(404,'Película no encontrada en Apple.');
      m=mapApple(json.results[0]);
    }
    persistMovies(db,[m]); return addScore(db,m);
  } catch(err) {
    if(local) return addScore(db,dbRow(local));
    throw fail(err.status||502,err.message||'No se pudo recuperar la película.');
  }
}
module.exports = {popular, getMovie, sourceName, persistMovies, addScore, GENRE_NAMES};
