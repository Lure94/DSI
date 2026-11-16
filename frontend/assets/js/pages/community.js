/** KHARELL — reseñas públicas, reportes, moderación, usuarios y contacto. */
import {api,getCurrentUser} from '../api.js';
import {GENRES} from '../data.js';
import {$,escapeHTML,toast,reviewCard,shortDate} from '../ui.js';

let genre='Todos',pageNum=1;
export async function reviewsPage() {
  const root=$('#reviews-grid'),filters=$('#review-filters');
  let reviews=[];
  try {reviews=(await api('/reviews')).items;}catch(error){toast(error.message,true);}
  filters.innerHTML=GENRES.map(g=>`<button type="button" class="chip ${genre===g?'active':''}" data-genre="${escapeHTML(g)}">${escapeHTML(g)}</button>`).join('');
  function render() {
    const term=$('#review-search').value.trim().toLowerCase(),order=$('#review-sort').value;
    let items=reviews.filter(r=>(genre==='Todos'||(r.movie?.genre||'').includes(genre))&&(!term||`${r.movie?.title} ${r.text} ${r.author}`.toLowerCase().includes(term)));
    items=[...items];
    if(order==='highest')items.sort((a,b)=>b.rating-a.rating);
    if(order==='lowest')items.sort((a,b)=>a.rating-b.rating);
    if(order==='recent')items.sort((a,b)=>b.id-a.id);
    const limit=6,pages=Math.max(1,Math.ceil(items.length/limit));pageNum=Math.min(pageNum,pages);
    root.innerHTML=items.slice((pageNum-1)*limit,pageNum*limit).map(reviewCard).join('');
    $('#review-count').textContent=`${items.length} reseñas encontradas`;
    $('#reviews-empty').classList.toggle('hidden',!!items.length);
    $('#review-pagination').innerHTML=pages>1?Array.from({length:pages},(_,i)=>`<button type="button" class="page-button ${pageNum===i+1?'active':''}" data-page-number="${i+1}">${i+1}</button>`).join(''):'';
  }
  filters.addEventListener('click',event=>{
    const b=event.target.closest('[data-genre]');if(!b)return;
    genre=b.dataset.genre;pageNum=1;
    filters.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',b===x));render();
  });
  $('#review-search').addEventListener('input',()=>{pageNum=1;render();});
  $('#review-sort').addEventListener('change',render);
  $('#review-pagination').addEventListener('click',event=>{
    const b=event.target.closest('[data-page-number]');if(!b)return;
    pageNum=Number(b.dataset.pageNumber);render();
    window.scrollTo({top:0,behavior:'smooth'});
  });
  render();
}

export async function adminPage() {
  const root=$('#admin-content'),user=getCurrentUser();
  if(!user||user.role!=='admin') {
    root.innerHTML='<div class="empty-state"><h2>Acceso restringido</h2><p>Solo el administrador puede revisar reportes y gestionar usuarios.</p><a href="login.html" class="button button--gold">Iniciar sesión</a></div>';
    $('.admin-tabs')?.classList.add('hidden');return;
  }
  let tab='reports';
  async function render() {
    try {
      if(tab==='reports') {
        const reports=(await api('/reports')).items;
        root.innerHTML=reports.length?reports.map(r=>`<article class="admin-item"><div><h3>Reporte <span class="status ${r.status!=='pendiente'?'done':''}">${escapeHTML(r.status)}</span></h3><small>#${r.id} · ${shortDate(r.date)} · ${escapeHTML(r.reason)}</small><p>${escapeHTML(r.reviewExcerpt)}</p><small>Reportado por: ${escapeHTML(r.reporter)}</small></div><div class="admin-actions">${r.status==='pendiente'?`<button data-report="${r.id}" data-action="descartado">Descartar</button><button class="danger" data-report="${r.id}" data-action="retirada">Retirar reseña</button>`:''}</div></article>`).join(''):'<div class="empty-state"><h2>No hay reportes</h2><p>Los reportes aparecerán aquí.</p></div>';
        root.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',async()=>{
          if(b.dataset.action==='retirada'&&!confirm('¿Retirar esta reseña de la comunidad?'))return;
          try {await api(`/reports/${b.dataset.report}`,{method:'PATCH',body:{action:b.dataset.action}});toast('Reporte resuelto.');await render();}
          catch(error){toast(error.message,true);}
        }));
      } else {
        const users=(await api('/users')).items;
        root.innerHTML=users.map(u=>`<article class="admin-item"><div><h3>${escapeHTML(u.name)}</h3><small>${escapeHTML(u.email)} · ${u.role==='admin'?'Administrador':'Usuario registrado'}</small></div><div class="admin-actions">${u.id!==user.id?`<button type="button" class="danger" data-delete-user="${u.id}">Eliminar perfil</button>`:''}</div></article>`).join('');
        root.querySelectorAll('[data-delete-user]').forEach(b=>b.addEventListener('click',async()=>{
          if(!confirm('¿Eliminar permanentemente esta cuenta y sus datos relacionados?'))return;
          try {await api(`/users/${b.dataset.deleteUser}`,{method:'DELETE'});toast('Perfil eliminado.');await render();}
          catch(error){toast(error.message,true);}
        }));
      }
    } catch(error){root.innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;}
  }
  $('.admin-tabs').addEventListener('click',event=>{
    const b=event.target.closest('[data-admin-tab]');if(!b)return;
    tab=b.dataset.adminTab;
    $('.admin-tabs').querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===b));
    render();
  });
  await render();
}

export function contactPage() {
  const form=$('#contact-form');
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    try {
      await api('/contact',{method:'POST',body:{
        name:$('#contact-name').value.trim(),
        email:$('#contact-email').value.trim(),
        subject:$('#contact-subject').value.trim(),
        content:$('#contact-message').value.trim()
      }});
      toast('Mensaje recibido y registrado por CineReview.');form.reset();
    } catch(error){toast(error.message,true);}
  });
}
