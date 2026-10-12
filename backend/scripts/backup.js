'use strict';

/**
 * Script de respaldo de SQLite.
 * Crea una copia consistente y ejecuta PRAGMA integrity_check para verificarla.
 */
const { backup, DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const databaseFile = path.join(__dirname, '..', 'data', 'cinereview.sqlite');

if (!fs.existsSync(databaseFile)) {
  console.error('No existe base de datos. Ejecuta primero node backend/server.js');
  process.exit(1);
}

const backupFile = path.join(
  __dirname,
  '..',
  'backups',
  `cinereview-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
);

fs.mkdirSync(path.dirname(backupFile), { recursive: true });
const db = new DatabaseSync(databaseFile);

backup(db, backupFile)
  .then(() => {
    const copy = new DatabaseSync(backupFile, { readOnly: true });
    const result = copy.prepare('PRAGMA integrity_check').get();

    copy.close();
    db.close();

    if (result.integrity_check !== 'ok') {
      throw new Error('Fallo en la integridad del respaldo.');
    }

    console.log('Respaldo SQLite verificado:', backupFile);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
