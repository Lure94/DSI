/** CineReview — comunicación REST real con backend y sesión de usuario. */
const BASE = '';
const KEY = 'cinereview-server-session-v1';

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}
function getCurrentUser() { return getSession()?.user || null; }
function saveSession(session, remember = false) {
  sessionStorage.removeItem(KEY);
  localStorage.removeItem(KEY);
  (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
}
function clearSession() { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); }
async function api(path,{method='GET',body}={}) {
  const headers = {'Accept':'application/json'};
  const token = getSession()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type']='application/json';
  let response;
  try {
    response=await fetch(BASE + '/api' + path,{method,headers,
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  } catch(error) {
    throw Error('No se pudo conectar con el backend. Verifica /api/health.');
  }
  let payload;
  try { payload=await response.json(); }
  catch { throw Error('El servidor no devolvió JSON válido.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') clearSession();
    throw Error(payload.error || `Error ${response.status}`);
  }
  return payload;
}
async function loginAccount(email,password,remember=false) {
  const r=await api('/auth/login',{method:'POST',body:{email,password}});
  saveSession(r,remember);return r.user;
}
async function registerAccount({name,email,password,terms}) {
  const r=await api('/auth/register',{method:'POST',body:{name,email,password,terms}});
  saveSession(r);return r.user;
}
async function logout() {
  try { await api('/auth/logout',{method:'POST',body:{}}); } catch { /* Invalidar la sesión local siempre. */ }
  clearSession();
}
export {api,getSession,getCurrentUser,saveSession,clearSession,loginAccount,registerAccount,logout};
