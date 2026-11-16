/** Metadatos de películas obtenidos solo de TMDB/Apple por el backend. */
const KEY = 'cinereview-backend-movies-v1';
export const GENRES = [
  'Todos','Acción','Aventura','Ciencia ficción','Drama','Romance',
  'Animación','Suspenso','Misterio','Terror','Fantasía','Comedia',
  'Documental','Familiar','Otros'
];
function fromCache() {
  try {
    const obj=JSON.parse(sessionStorage.getItem(KEY) || '{}');
    if(Date.now()-obj.at < 4 * 60 * 60 * 1000 && Array.isArray(obj.movies)) return obj.movies;
  } catch { /* Solo caché visual: nunca fuente de reseñas o cuentas. */ }
  return [];
}
export const LIVE_MOVIES = fromCache();
export function setLiveMovies(movies,{merge=false}={}) {
  const rows=new Map((merge?LIVE_MOVIES:[]).map(m=>[m.id,m]));
  movies.forEach(m=>{ if(/^(apple|tmdb)-\d+$/.test(m.id))rows.set(m.id,m); });
  LIVE_MOVIES.splice(0,LIVE_MOVIES.length,...Array.from(rows.values()).slice(0,250));
  sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),movies:LIVE_MOVIES}));
}
export const getCatalogMovies=()=>[...LIVE_MOVIES];
export const getAvailableGenres=()=>[
  'Todos', ...new Set(getCatalogMovies().flatMap(m=>(m.genre||'').split(',').map(s=>s.trim())).filter(Boolean))
];
export const movieById=id=>LIVE_MOVIES.find(m=>m.id===id);
export const posterFor=id=>movieById(id)?.poster || 'assets/img/poster-no-disponible.svg';
