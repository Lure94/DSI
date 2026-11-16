/** La clave TMDB solo está en backend/.env; este módulo nunca toca proveedores externos. */
import {api} from './api.js';
import {setLiveMovies,getCatalogMovies,movieById} from './data.js';

export async function loadLiveCatalog({force=false,page=1}={}) {
  // El servidor guarda temporalmente la respuesta real para limitar peticiones.
  const result=await api(`/movies?page=${encodeURIComponent(page)}`);
  setLiveMovies(result.items,{merge:page>1});
  return getCatalogMovies();
}
export async function searchAndRemember(term) {
  const result=await api(`/movies?query=${encodeURIComponent(term)}`);
  setLiveMovies(result.items,{merge:true});
  return result.items;
}
export async function loadMovieById(id) {
  const result=await api(`/movies/${encodeURIComponent(id)}`);
  setLiveMovies([result.movie],{merge:true});
  return result.movie;
}
