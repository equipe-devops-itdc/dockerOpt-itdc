// ============================================================
// routes/notifications.js — POST /api/notifications/test-email
// ============================================================

const express = require('express');
const { mailer } = require('../notifications/mailer');
const { SMTP_FROM, ALERT_EMAIL_TO } = require('../config');

const router = express.Router();

router.post('/api/notifications/test-email', async (req, res) => {
  if (!mailer) {
    return res.status(501).json({ error: 'SMTP non configuré — définissez SMTP_HOST, SMTP_USER et SMTP_PASSWORD.' });
  }
  try {
    await mailer.sendMail({
      from: SMTP_FROM,
      to: ALERT_EMAIL_TO,
      subject: '[DockerOpt] Email de test',
      html: '<p>Si vous recevez ce message, les notifications DockerOpt sont correctement configurées.</p>'
    });
    res.json({ success: true, message: `Email de test envoyé à ${ALERT_EMAIL_TO}` });
  } catch (err) {
    res.status(500).json({ error: `Échec de l'envoi : ${err.message}` });
  }
});

module.exports = router;