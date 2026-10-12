'use strict';

/**
 * Utilidades HTTP del servidor.
 * Centralizan lectura JSON, respuestas, CORS, archivos estáticos y despacho de rutas.
 */
const { URL } = require('node:url');
const { extname, resolve, sep } = require('node:path');
const fs = require('node:fs');

const { currentUser } = require('../middleware/auth');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

/** Crea un error HTTP controlado con código de estado. */
const fail = (status, message) => Object.assign(new Error(message), { status });

/** Lee y valida el cuerpo JSON de una solicitud. */
async function readJson(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    throw fail(415, 'Envía Content-Type: application/json.');
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64_000) throw fail(413, 'Solicitud demasiado grande.');
    chunks.push(chunk);
  }

  try {
    const data = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch {
    throw fail(400, 'JSON inválido.');
  }
}

/** Envía una respuesta JSON consistente. */
function send(res, status, body) {
  if (res.writableEnded) return;

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

/** Configura CORS local y encabezados básicos de seguridad. */
function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowedLocalOrigin = /^http:\/\/(localhost|127\.0\.0\.1):(3000|5500|5501|5502|5173)$/;

  if (allowedLocalOrigin.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/** Sirve archivos del frontend cuando la URL no pertenece a /api. */
function staticFile(frontendDir, req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;

  let name;
  try {
    name = decodeURIComponent(url.pathname);
  } catch {
    throw fail(400, 'Ruta inválida');
  }

  if (name === '/') name = '/index.html';
  if (name.includes('\0') || name.includes('\\')) throw fail(400, 'Ruta inválida');

  const dir = resolve(frontendDir);
  const full = resolve(dir, `.${name}`);

  if (full !== dir && !full.startsWith(dir + sep)) throw fail(403, 'Ruta restringida');
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;

  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(full)] || 'application/octet-stream',
  });

  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(full).pipe(res);

  return true;
}

/**
 * Crea el manejador principal de la arquitectura Cliente-Servidor.
 * Las rutas delegan a controladores; este archivo no implementa lógica de negocio.
 */
function createHandler({ db, env, frontendDir, routes }) {
  return async (req, res) => {
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    try {
      // Las URLs que no comienzan con /api pertenecen al frontend.
      if (!url.pathname.startsWith('/api/')) {
        if (!staticFile(frontendDir, req, res, url)) {
          send(res, 404, { error: 'Archivo no encontrado' });
        }
        return;
      }

      // Contexto compartido por todas las rutas del backend.
      const ctx = {
        req,
        res,
        url,
        db,
        env,
        user: currentUser(db, req),
        json: () => readJson(req),
        send: (status, body) => send(res, status, body),
        fail,
      };

      for (const route of routes) {
        if (await route(ctx)) return;
      }

      send(res, 404, { error: 'Endpoint no encontrado.' });
    } catch (error) {
      if (!error.status) console.error('Error interno del servidor:', error);

      send(res, error.status || 500, {
        error: error.status ? error.message : 'Error interno del servidor.',
      });
    }
  };
}

module.exports = { createHandler, fail };
