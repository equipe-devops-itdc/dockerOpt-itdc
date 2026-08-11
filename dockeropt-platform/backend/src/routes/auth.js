// ============================================================
// routes/auth.js — connexion (accessible sans jeton) et /me
// (protégée). Deux routers séparés pour que app.js puisse monter
// le login AVANT le middleware d'authentification, et /me APRÈS,
// exactement comme dans le fichier d'origine.
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');

const publicAuthRouter = express.Router();
const protectedAuthRouter = express.Router();

publicAuthRouter.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  try {
    const user = await authenticateUser(email, password);
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
    const token = jwt.sign(
      { sub: String(user.id), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ token, user: { email: user.email, role: user.role } });
  } catch (err) {
    console.error('[DockerOpt] Auth PostgreSQL:', err.message);
    res.status(503).json({ error: 'Service d’authentification temporairement indisponible' });
  }
});

protectedAuthRouter.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user });
});

module.exports = { publicAuthRouter, protectedAuthRouter };