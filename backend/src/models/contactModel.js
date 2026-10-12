'use strict';

/** MODELO MVC: mensajes enviados desde el formulario de contacto. */
function create(db, { name, email, subject, content }) {
  const result = db
    .prepare('INSERT INTO contact_messages(name,email,subject,content) VALUES (?,?,?,?)')
    .run(name, email, subject, content);
  return Number(result.lastInsertRowid);
}

module.exports = { create };
