// ============================================================
// notifications/mailer.js — transporteur SMTP + mise en forme et
// envoi de l'email d'alerte groupée.
// ============================================================

const nodemailer = require('nodemailer');
const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD,
  SMTP_FROM, ALERT_EMAIL_TO, PLATFORM_URL,
} = require('../config');

let mailer = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  console.log(`[DockerOpt] Notifications email activées (${SMTP_HOST} → ${ALERT_EMAIL_TO})`);
} else {
  console.warn('[DockerOpt] SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASSWORD manquants) — notifications email désactivées.');
}

function severityLabel(sev) {
  return sev === 'critical' ? 'CRITIQUE' : sev === 'warning' ? 'Avertissement' : 'Info';
}

async function sendAlertEmail(alerts) {
  if (!mailer || !alerts.length) return;

  const rows = alerts.map((a) =>
    `<tr>
       <td style="padding:6px 10px;color:${a.severity === 'critical' ? '#DC2626' : '#D97706'};font-weight:600;white-space:nowrap;">${severityLabel(a.severity)}</td>
       <td style="padding:6px 10px;">${a.title}</td>
       <td style="padding:6px 10px;color:#555;">${a.detail || ''}</td>
     </tr>`
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;">
      <h2 style="color:#111;">DockerOpt — Nouvelles alertes détectées</h2>
      <p style="color:#555;">${alerts.length} nouvelle${alerts.length > 1 ? 's' : ''} alerte${alerts.length > 1 ? 's' : ''} nécessite${alerts.length > 1 ? 'nt' : ''} votre attention.</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#F3F4F6;text-align:left;">
            <th style="padding:6px 10px;">Sévérité</th>
            <th style="padding:6px 10px;">Alerte</th>
            <th style="padding:6px 10px;">Détail</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:20px;">Envoyé automatiquement par DockerOpt — <a href="${PLATFORM_URL}">ouvrir la plateforme</a> pour voir la cause, les métriques et les recommandations.</p>
    </div>`;

  try {
    await mailer.sendMail({
      from: SMTP_FROM,
      to: ALERT_EMAIL_TO,
      subject: `[DockerOpt] ${alerts.length} nouvelle${alerts.length > 1 ? 's' : ''} alerte${alerts.length > 1 ? 's' : ''} détectée${alerts.length > 1 ? 's' : ''}`,
      html
    });
    console.log(`[DockerOpt] Email d'alerte envoyé (${alerts.length} alerte(s)) à ${ALERT_EMAIL_TO}`);
  } catch (err) {
    console.error('[DockerOpt] Échec de l\'envoi de l\'email d\'alerte :', err.message);
  }
}

module.exports = { mailer, sendAlertEmail, severityLabel };