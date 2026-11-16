/** FERNANDO — autenticación y gestión de reseñas propias mediante API REST. */
import { api, loginAccount, registerAccount, getCurrentUser } from '../api.js';
import { $, page, escapeHTML, selectedStars, shortDate, toast, movieURL } from '../ui.js';

function passwordToggles() {
  document.querySelectorAll('.password-toggle').forEach(button=>{
    button.addEventListener('click',()=>{
      const input=button.previousElementSibling;
      input.type=input.type==='password'?'text':'password';
    });
  });
  document.querySelectorAll('[data-demo-social]').forEach(button=>{
    button.addEventListener('click',()=>toast('El proyecto no contempla autenticación con terceros.',true));
  });
}
function redirectAfterLogin() {
  const next=new URLSearchParams(location.search).get('next');
  // Solo rutas locales explícitas: nunca redireccionar a dominios ajenos.
  location.href=(next && /^(detalle|mis-resenas|resenas|peliculas|admin)\.html(?:\?.*)?$/.test(next))
    ? next : 'index.html';
}
export function authPages() {
  passwordToggles();
  if(page==='login') {
    $('#login-form').addEventListener('submit',async event=>{
      event.preventDefault();
      if(!event.currentTarget.reportValidity())return;
      try {
        await loginAccount($('#login-email').value.trim(),$('#login-password').value,$('#remember-me')?.checked);
        redirectAfterLogin();
      } catch(error){toast(error.message,true);}
    });
  }
  if(page==='register') {
    $('#register-form').addEventListener('submit',async event=>{
      event.preventDefault();if(!event.currentTarget.reportValidity())return;
      const password=$('#reg-password').value;
      if(password!==$('#reg-confirm').value){toast('Las contraseñas no coinciden.',true);return;}
      try {
        await registerAccount({
          name:$('#reg-name').value.trim(),email:$('#reg-email').value.trim(),
          password,terms:$('#reg-terms').checked
        });
        redirectAfterLogin();
      } catch(error){toast(error.message,true);}
    });
  }
  if(page==='recover') {
    const token=new URLSearchParams(location.search).get('token');
    if(token) {
      const inner=$('.auth-inner');
      inner.innerHTML=`<span class="eyebrow">NUEVA CONTRASEÑA</span><h1>Establecer contraseña</h1><form id="reset-form"><label for="new-password">Contraseña nueva (mínimo 8 caracteres)</label><input id="new-password" type="password" minlength="8" required autocomplete="new-password"><label for="confirm-password">Confirmación</label><input id="confirm-password" type="password" minlength="8" required autocomplete="new-password"><button class="button button--gold button--full" type="submit">Guardar contraseña</button></form><p class="auth-bottom"><a href="login.html">Volver a iniciar sesión</a></p>`;
      $('#reset-form').addEventListener('submit',async event=>{
        event.preventDefault();if(!event.currentTarget.reportValidity())return;
        const password=$('#new-password').value;
        if(password!==$('#confirm-password').value){toast('Las contraseñas no coinciden.',true);return;}
        try {
          await api('/auth/reset',{method:'POST',body:{token,password}});
          toast('Contraseña actualizada. Ahora puedes iniciar sesión.');
          setTimeout(()=>location.href='login.html',1100);
        } catch(error){toast(error.message,true);}
      });
    } else {
      $('#recover-form').addEventListener('submit',async event=>{
        event.preventDefault();if(!event.currentTarget.reportValidity())return;
        try {
          const r=await api('/auth/recover',{method:'POST',body:{email:$('#recover-email').value.trim()}});
          toast(r.message);
        } catch(error){toast(error.message,true);}
      });
    }
  }
}

export async function myReviewsPage() {
  const root=$('#my-reviews-container');
  const user=getCurrentUser();
  if(!user){root.innerHTML='<div class="empty-state"><h2>Debes iniciar sesión</h2><a class="button button--gold" href="login.html?next=mis-resenas.html">Iniciar sesión</a></div>';return;}
  async function render() {
    let items;
    try {items=(await api('/reviews/mine')).items;}
    catch(error){root.innerHTML=`<div class="empty-state">${escapeHTML(error.message)}</div>`;return;}
    root.innerHTML=items.length ? items.map(r=>{
      const m=r.movie||{id:r.movieId,title:'Película',poster:'assets/img/poster-no-disponible.svg'};
      return `<article class="my-review" data-own="${r.id}"><img src="${escapeHTML(m.poster)}" alt="Cartel de ${escapeHTML(m.title)}" onerror="this.onerror=null;this.src='assets/img/poster-no-disponible.svg'"><div><a href="${movieURL(r.movieId)}"><strong>${escapeHTML(m.title)}</strong></a><div>${selectedStars(r.rating)} <small>${shortDate(r.date)}</small></div><p class="my-text">${escapeHTML(r.text)}</p><div class="my-review__actions"><button type="button" data-edit="${r.id}">Editar</button><button type="button" class="danger" data-delete="${r.id}">Eliminar</button></div></div></article>`;
    }).join(''):'<div class="empty-state"><h2>Todavía no has publicado reseñas</h2><p>Explora el catálogo para escribir la primera.</p></div>';
    root.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{
      if(!confirm('¿Eliminar esta reseña permanentemente?'))return;
      try {await api(`/reviews/${button.dataset.delete}`,{method:'DELETE'});toast('Reseña eliminada.');await render();}
      catch(error){toast(error.message,true);}
    }));
    root.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>{
      const item=items.find(r=>String(r.id)===button.dataset.edit);
      const article=button.closest('[data-own]');
      if(!item||article.querySelector('textarea'))return;
      const text=article.querySelector('.my-text');
      text.insertAdjacentHTML('afterend',`<textarea aria-label="Editar reseña" maxlength="1200">${escapeHTML(item.text)}</textarea><div class="my-review__actions"><button type="button" data-save>Guardar cambios</button><button type="button" data-cancel>Cancelar</button></div>`);
      text.classList.add('hidden');
      article.querySelector('[data-save]').addEventListener('click',async()=>{
        const value=article.querySelector('textarea').value.trim();
        if(value.length<10){toast('La reseña debe tener al menos 10 caracteres.',true);return;}
        try {await api(`/reviews/${item.id}`,{method:'PUT',body:{text:value}});toast('Cambios guardados.');await render();}
        catch(error){toast(error.message,true);}
      });
      article.querySelector('[data-cancel]').addEventListener('click',render);
    }));
  }
  await render();
}
