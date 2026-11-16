/** LAUREANO — portada, consulta de películas, ficha, reseñas de película y estrellas. */
import { api, getCurrentUser } from '../api.js';
import { getCatalogMovies, getAvailableGenres, movieById } from '../data.js';
import { loadLiveCatalog, searchAndRemember, loadMovieById } from '../movie-api.js';
import {
  $, escapeHTML, user, selectedStars, shortDate, initial,
  toast, requireUser, score, movieCard
} from '../ui.js';

export async function home() {
  const grid = $('#home-movies');
  const status = $('#home-source');
  grid.innerHTML='<p class="api-status">Consultando el catálogo de películas…</p>';
  try {
    await loadLiveCatalog();
    grid.innerHTML=getCatalogMovies().slice(0,5).map(movieCard).join('') || '<p>Sin películas disponibles.</p>';
    status.textContent='Fichas y carteles obtenidos de la API de películas';
  } catch(error) {
    grid.innerHTML='<div class="empty-state">No se pudo cargar el catálogo. Comprueba el backend o Internet.</div>';
    status.textContent=error.message;
    console.error(error);
  }
  try {
    const {items}=await api('/reviews');
    const {reviewCard}=await import('../ui.js');
    $('#home-reviews').innerHTML=items.length
      ? items.slice(0,3).map(reviewCard).join('')
      : '<div class="empty-state"><p>¡Todavía no hay reseñas! Sé el primero en opinar.</p></div>';
    const stat=$('.stat-block strong');if(stat)stat.textContent=String(items.length);
  } catch(error) {
    $('#home-reviews').innerHTML=`<p class="api-status">${escapeHTML(error.message)}</p>`;
  }
}

let currentGenre='Todos';
export async function moviesPage() {
  const chips=$('#genre-filters'),search=$('#movie-search'),status=$('#catalog-source');
  let remoteResults=null,viewCount=10,requestNum=0,timer;
  function genres() {
    const names=getAvailableGenres();
    chips.innerHTML=names.map(n=>`<button type="button" data-genre="${escapeHTML(n)}" class="chip ${n===currentGenre?'active':''}">${escapeHTML(n)}</button>`).join('');
  }
  function draw() {
    const term=search.value.trim().toLocaleLowerCase('es');
    const sort=$('#movie-sort').value;
    let items=[...(remoteResults??getCatalogMovies())];
    items=items.filter(m=>(currentGenre==='Todos'||(m.genre||'').includes(currentGenre))&&(!term||m.title.toLocaleLowerCase('es').includes(term)));
    if(sort==='rating')items.sort((a,b)=>(Number(b.avgRating)||0)-(Number(a.avgRating)||0));
    if(sort==='recent')items.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
    if(sort==='az')items.sort((a,b)=>a.title.localeCompare(b.title,'es'));
    $('#movies-grid').innerHTML=items.slice(0,viewCount).map(movieCard).join('');
    $('#movie-count').textContent=`Mostrando ${Math.min(viewCount,items.length)} de ${items.length} películas`;
    $('#movies-empty').classList.toggle('hidden',!!items.length);
    $('#more-movies').classList.toggle('hidden',items.length<=viewCount);
  }
  function clear() {
    currentGenre='Todos';remoteResults=null;viewCount=10;search.value='';
    $('#movie-sort').value='popular';genres();draw();
  }
  chips.addEventListener('click',event=>{
    const b=event.target.closest('[data-genre]');if(!b)return;
    currentGenre=b.dataset.genre;viewCount=10;genres();draw();
  });
  search.addEventListener('input',()=>{
    const term=search.value.trim();const seq=++requestNum;
    clearTimeout(timer);viewCount=10;remoteResults=null;draw();
    if(term.length<3){status.textContent='Catálogo obtenido desde el backend';return;}
    timer=setTimeout(async()=>{
      status.textContent=`Buscando «${term}»…`;
      try {
        const found=await searchAndRemember(term);
        if(seq!==requestNum)return;
        remoteResults=found;currentGenre='Todos';genres();draw();
        status.textContent=`${found.length} resultados reales de la API`;
      } catch(error) { if(seq===requestNum){status.textContent=error.message;toast(error.message,true);} }
    },550);
  });
  $('#movie-sort').addEventListener('change',draw);
  $('#more-movies').addEventListener('click',()=>{viewCount+=10;draw();});
  $('#clear-movie-filters').addEventListener('click',()=>{requestNum++;clearTimeout(timer);clear();});
  $('#catalog-refresh').addEventListener('click',async()=>{requestNum++;clear();await refresh();});
  async function refresh() {
    status.textContent='Consultando la API de películas…';
    try {
      await loadLiveCatalog();genres();draw();
      status.textContent='Catálogo real actualizado. Las estrellas son solo de CineReview.';
    } catch(error) {status.textContent=error.message;draw();}
  }
  genres();await refresh();
}

function ratingPicker(root,initialRating=0,onSelect=()=>{}) {
  let rating=initialRating;
  function render(){root.innerHTML=Array.from({length:5},(_,i)=>`<button type="button" class="${i<rating?'selected':''}" data-star="${i+1}" aria-label="${i+1} estrellas" aria-pressed="${rating===i+1}">★</button>`).join('');}
  root.addEventListener('click',event=>{const b=event.target.closest('[data-star]');if(!b)return;rating=Number(b.dataset.star);onSelect(rating);render();});
  render();
}
async function reportReview(id,refresh) {
  if(!requireUser())return;
  let reason=prompt('Motivo del reporte (lenguaje inapropiado, contenido ofensivo, spam u otro):','Contenido inapropiado');
  if(reason===null)return;
  reason=reason.trim();
  if(reason.length<3){toast('Escribe un motivo para el reporte.',true);return;}
  try {await api('/reports',{method:'POST',body:{reviewId:Number(id),reason}});toast('Reporte enviado al administrador.');await refresh();}
  catch(error){toast(error.message,true);}
}

export async function detailPage() {
  const id=new URLSearchParams(location.search).get('id');
  $('#movie-detail').innerHTML='<div class="empty-state">Cargando ficha real…</div>';
  let movie;
  try {movie=await loadMovieById(id);} catch(error) {
    $('#movie-detail').innerHTML=`<div class="empty-state"><h2>Película no disponible</h2><p>${escapeHTML(error.message)}</p><a href="peliculas.html" class="button button--gold">Volver al catálogo</a></div>`;
    $('#detail-write')?.classList.add('hidden');return;
  }
  document.title=`${movie.title} | CineReview`;
  $('#crumb-title').textContent=movie.title;
  let myRating=0;
  try {myRating=(await api(`/ratings/${encodeURIComponent(id)}`)).myRating||0;}catch { /* Visitantes pueden leer sin cuenta. */ }
  function showMovie(){
    $('#movie-detail').innerHTML=`<section class="detail-hero"><img src="${escapeHTML(movie.poster)}" alt="Cartel de ${escapeHTML(movie.title)}" onerror="this.onerror=null;this.src='assets/img/poster-no-disponible.svg'"><div><span class="eyebrow">CINE · HISTORIAS QUE CONECTAN</span><h1>${escapeHTML(movie.title)}</h1><div class="detail-meta"><span>${movie.year||'—'}</span><span>${escapeHTML(movie.genre||'Otros')}</span><span>${movie.minutes?`${movie.minutes} min`:'Duración no disponible'}</span></div><p class="detail-description">${escapeHTML(movie.synopsis||'Sin sinopsis disponible.')}</p><div class="detail-rating"><strong>★ ${score(movie)}</strong><div>${selectedStars(Math.round(Number(movie.avgRating)||0))}<small>Calificaciones registradas en CineReview (${movie.ratingCount||0})</small></div></div><div id="movie-rate-box"><div class="eyebrow">MI CALIFICACIÓN</div><div class="stars-picker" id="rate-stars"></div><button class="button button--outline" id="save-rating" type="button">Guardar calificación</button></div><div class="detail-actions" style="margin-top:20px"><button type="button" class="button button--gold" id="movie-write-review">Escribir reseña</button><a class="button button--glass" href="peliculas.html">Regresar al catálogo</a>${movie.sourceUrl?`<a href="${escapeHTML(movie.sourceUrl)}" class="button button--outline" target="_blank" rel="noopener noreferrer">Fuente de película ↗</a>`:''}</div><p class="film-attribution">Cartel e información: ${escapeHTML(movie.source)}. Reseñas y estrellas: usuarios de CineReview.</p></div></section>`;
    let selected=myRating;
    ratingPicker($('#rate-stars'),myRating,n=>{selected=n;});
    $('#save-rating').addEventListener('click',async()=>{
      if(!requireUser())return;
      if(!selected){toast('Elige entre 1 y 5 estrellas.',true);return;}
      try {
        await api('/ratings',{method:'POST',body:{movieId:id,rating:selected}});
        myRating=selected;
        const updated=await loadMovieById(id);movie={...updated};
        toast('Calificación guardada en la base de datos.');showMovie();await showReviews();
      }catch(error){toast(error.message,true);}
    });
    $('#movie-write-review').addEventListener('click',openForm);
  }
  function openForm(){if(!requireUser())return;$('#review-form').classList.remove('hidden');$('#review-form').scrollIntoView({behavior:'smooth',block:'center'});}
  async function showReviews(){
    try {
      const {items}=await api(`/reviews?movieId=${encodeURIComponent(id)}`);
      $('#detail-reviews-grid').innerHTML=items.length?items.map(r=>`<article class="review-item"><div class="review-item__meta"><span><span class="avatar" style="display:inline-grid;margin-right:10px">${initial(r.author)}</span><span class="review-item__author">${escapeHTML(r.author)}</span> <small>${shortDate(r.date)}</small></span>${selectedStars(r.rating)}</div><p>${escapeHTML(r.text)}</p>${user?.id!==r.userId?`<button type="button" data-report="${r.id}">⚑ Reportar reseña</button>`:'<a href="mis-resenas.html" class="text-link">Administrar mi reseña →</a>'}</article>`).join(''):'<div class="empty-state">Todavía no hay reseñas para esta película.</div>';
      $('#detail-reviews-grid').querySelectorAll('[data-report]').forEach(b=>b.addEventListener('click',()=>reportReview(b.dataset.report,showReviews)));
    } catch(error){$('#detail-reviews-grid').innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;}
  }
  $('#detail-write').addEventListener('click',openForm);
  let selectedReviewRating=0;
  ratingPicker($('#stars-picker'),0,n=>{selectedReviewRating=n;});
  $('#review-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!requireUser())return;
    const text=$('#review-content').value.trim();
    if(text.length<10||text.length>1200||selectedReviewRating<1){toast('Escribe 10-1200 caracteres y elige estrellas.',true);return;}
    try {
      await api('/reviews',{method:'POST',body:{movieId:id,text,rating:selectedReviewRating}});
      toast('¡Reseña publicada en la base de datos!');
      $('#review-form').reset();$('#review-form').classList.add('hidden');
      const updated=await loadMovieById(id);movie={...updated};myRating=selectedReviewRating;
      showMovie();await showReviews();
    }catch(error){toast(error.message,true);}
  });
  showMovie();await showReviews();
}
