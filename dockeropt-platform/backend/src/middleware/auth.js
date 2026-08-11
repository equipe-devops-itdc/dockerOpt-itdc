// ============================================================
// middleware/auth.js — vérifie le jeton JWT sur toutes les routes
// /api/*, sauf celles listées dans PUBLIC_PATHS (login, /health,
// /metrics) qui doivent rester accessibles sans jeton.
// ============================================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET, PUBLIC_PATHS } = require('../config');

function authMiddleware(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (!req.path.startsWith('/api/')) return next(); // routes non-API (aucune ici, sécurité par défaut)

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session invalide ou expirée, veuillez vous reconnecter' });
  }
}

module.exports = { authMiddleware };