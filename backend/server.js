'use strict';

/**
 * Punto de entrada del backend de CineReview.
 *
 * Arquitectura Cliente-Servidor:
 * - El navegador/frontend es el CLIENTE.
 * - Este proceso Node.js es el SERVIDOR.
 * - El servidor recibe solicitudes HTTP y coordina rutas, controladores,
 *   modelos, SQLite y servicios externos como TMDB.
 * - El frontend nunca accede directamente a SQLite ni al token de TMDB.
 */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const { openDatabase } = require('./src/config/database');
const { bootstrapAdmin } = require('./src/middleware/auth');
const { createHandler } = require('./src/utils/http');

// Cada archivo de rutas representa una entrada del patrón MVC.
const routes = [
  require('./src/routes/authRoutes'),
  require('./src/routes/movieRoutes'),
  require('./src/routes/reviewRoutes'),
  require('./src/routes/ratingRoutes'),
  require('./src/routes/communityRoutes'),
];

/** Lee variables del archivo .env sin utilizar librerías externas. */
function readEnv(file = path.join(__dirname, '.env')) {
  const env = { ...process.env };

  if (!fs.existsSync(file)) return env;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('#')) continue;

    const match = /^([A-Z_]+)=(.*)$/.exec(cleanLine);
    if (match) {
      env[match[1]] = match[2].trim().replace(/^("|')(.*)\1$/, '$2');
    }
  }

  return env;
}

/**
 * Construye la aplicación para ejecución normal o para pruebas.
 * Permite inyectar una base de datos en memoria durante los tests.
 */
function createApp(options = {}) {
  const env = options.env || readEnv();
  const db = options.db || openDatabase(options.dbPath);

  if (options.bootstrap !== false) {
    bootstrapAdmin(db, env);
  }

  const frontendDir = options.frontendDir || path.join(__dirname, '..', 'frontend');
  const handler = createHandler({ db, env, frontendDir, routes });

  return {
    server: http.createServer(handler),
    db,
    env,
  };
}

// Si se ejecuta directamente, inicia el servidor HTTP.
if (require.main === module) {
  const { server, env } = createApp();
  const port = Number(env.PORT) || 3000;

  server.listen(port, () => {
    console.log(`CineReview: http://localhost:${port}`);
    console.log(`Comprobación de API: http://localhost:${port}/api/health`);
    console.log(
      env.TMDB_READ_TOKEN
        ? 'Catálogo: TMDB'
        : 'Catálogo: Apple/iTunes (alternativa pública, sin clave)',
    );

    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      console.log(
        'Administración: configura ADMIN_EMAIL y ADMIN_PASSWORD en backend/.env antes del primer arranque.',
      );
    }
  });
}

module.exports = { createApp, readEnv };
