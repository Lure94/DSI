'use strict';

/**
 * SERVICIO: envío de recuperación por correo.
 * El controlador de autenticación lo utiliza sin mezclar esta integración en las rutas.
 */
const { fail } = require('../utils/http');

async function sendResetMail(env, email, link) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Recuperación de contraseña CineReview',
      text: `Solicitaste restablecer tu contraseña. Este enlace dura 20 minutos: ${link}\nSi no lo solicitaste, ignora el mensaje.`,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw fail(502, 'No fue posible entregar el correo de recuperación.');
  }

  return true;
}

module.exports = { sendResetMail };
