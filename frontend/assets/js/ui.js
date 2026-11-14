/** Cabecera, pie y componentes accesibles que comparten las páginas. */
import {getCurrentUser,logout} from './api.js';
export const $=selector=>document.querySelector(selector);
export const escapeHTML=(input='')=>String(input).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const user=getCurrentUser();
export const page=document.body.dataset.page;
export const movieURL=id=>`detalle.html?id=${encodeURIComponent(id)}`;
export const selectedStars=n=>{const v=Math.min(5,Math.max(0,Math.round(Number(n)||0)));return `<span class="stars" aria-label="${v} de 5 estrellas">${'★'.repeat(v)}${'☆'.repeat(5-v)}</span>`};
export const shortDate=d=>{try{return new Intl.DateTimeFormat('es-NI',{day:'numeric',month:'short',year:'numeric'}).format(new Date(d.replace(' ','T')+'Z'));}catch{return String(d||'')}};
export const initial=name=>escapeHTML(String(name||'C').trim().charAt(0).toUpperCase());
export const toast=(message,error=false)=>{const el=$('#toast');if(!el)return;el.textContent=message;el.className=error?'show error':'show';clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>el.className='',5300)};
export const routeToLogin=()=>{const next=encodeURIComponent(location.pathname.split('/').pop()+location.search);location.href=`login.html?next=${next}`;};
export const requireUser=()=>{if(!getCurrentUser()){toast('Inicia sesión para participar.',true);setTimeout(routeToLogin,650);return null;}return getCurrentUser();};
export const score=m=>m.avgRating?Number(m.avgRating).toFixed(1):'—';

export function header() {
  const root=$('#site-header');if(!root)return;
  const nav=[['Inicio','index.html','home'],['Películas','peliculas.html','movies'],['Reseñas','resenas.html','reviews'],['Contacto','contacto.html','contact']];
  const links=nav.map(([text,url,id])=>`<a ${page===id?'class="active" aria-current="page"':''} href="${url}">${text}</a>`).join('');
  const account=user?`<div class="user-menu"><button id="account-toggle" type="button">${escapeHTML(user.name.split(' ')[0])} ▾</button><div id="account-dropdown" class="user-dropdown hidden"><a href="mis-resenas.html">Mis reseñas</a>${user.role==='admin'?'<a href="admin.html">Administración</a>':''}<button type="button" id="logout-button">Cerrar sesión</button></div></div>`:'<a class="button button--red" href="login.html">Iniciar sesión</a><a class="button button--gold" href="registro.html">Registrarse</a>';
  root.innerHTML=`<header class="site-header"><div class="container header-inner"><a class="brand" href="index.html">Cine<span>Review</span><span class="brand__mark">✦</span></a><nav class="main-nav">${links}</nav><div class="header-actions">${account}</div><button class="nav-toggle" id="nav-toggle" aria-label="Abrir menú">☰</button></div><div class="mobile-nav hidden" id="mobile-nav">${nav.map(([n,h])=>`<a href="${h}">${n}</a>`).join('')}${user?`<a href="mis-resenas.html">Mis reseñas</a>${user.role==='admin'?'<a href="admin.html">Administración</a>':''}<a href="#" id="mobile-logout">Cerrar sesión</a>`:'<a href="login.html">Iniciar sesión</a><a href="registro.html">Registrarse</a>'}</div></header>`;
  $('#nav-toggle')?.addEventListener('click',()=>$('#mobile-nav').classList.toggle('hidden'));
  $('#account-toggle')?.addEventListener('click',()=>$('#account-dropdown').classList.toggle('hidden'));
  const exit=async e=>{e?.preventDefault();await logout();location.href='index.html';};
  $('#logout-button')?.addEventListener('click',exit);
  $('#mobile-logout')?.addEventListener('click',exit);
}
export function footer(){const root=$('#site-footer');if(!root)return;root.innerHTML=`<footer class="site-footer"><div class="container footer-inner"><div><a href="index.html" class="brand">Cine<span>Review</span><span class="brand__mark">✦</span></a><p>Un lugar para descubrir películas y compartir las historias que te apasionan. Proyecto de Diseño de Sistemas en Internet.</p></div><div><h4>Explorar</h4><a href="peliculas.html">Catálogo</a><a href="resenas.html">Reseñas</a><a href="contacto.html">Contacto</a></div><div><h4>Comunidad</h4><a href="registro.html">Únete a CineReview</a><a href="mis-resenas.html">Mis reseñas</a><a href="terminos.html">Términos y condiciones</a></div></div><div class="footer-bottom">© 2026 CineReview · Películas: TMDB con token de backend o Apple TV/iTunes · Valoraciones: comunidad CineReview</div></footer>`;}
export function movieCard(m){return `<article class="movie-card"><a href="${movieURL(m.id)}" class="movie-card__poster" aria-label="Ver ${escapeHTML(m.title)}"><img src="${escapeHTML(m.poster)}" alt="Cartel de ${escapeHTML(m.title)}" loading="lazy" onerror="this.onerror=null;this.src='assets/img/poster-no-disponible.svg'"></a><div class="movie-card__body"><a class="movie-card__title" href="${movieURL(m.id)}">${escapeHTML(m.title)}</a><div class="movie-card__meta"><span>${m.year||'—'}</span><span class="movie-card__rating">★ ${score(m)}</span></div><div class="movie-card__genre">${escapeHTML(m.genre||'Otros')}</div></div></article>`;}
export function reviewCard(r){const m=r.movie||{id:r.movieId,title:'Película',poster:'assets/img/poster-no-disponible.svg'};const own=user&&user.id===r.userId;return `<article class="review-card"><a class="review-card__image" href="${movieURL(m.id)}"><img src="${escapeHTML(m.poster)}" alt="${escapeHTML(m.title)}" loading="lazy"></a><div class="review-card__content"><div class="review-card__top"><span class="review-card__movie">${escapeHTML(m.title)}</span>${selectedStars(r.rating)}</div><h3>${escapeHTML(m.title)}</h3><p class="review-card__text">${escapeHTML(r.text)}</p></div><div class="review-card__footer"><span class="review-card__author"><span class="avatar">${initial(r.author)}</span>${escapeHTML(r.author)}</span><span>${own?'<a href="mis-resenas.html">Mi reseña</a>':shortDate(r.date)}</span></div></article>`;}
