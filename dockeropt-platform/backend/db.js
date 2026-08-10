const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS optimization_history (
      id BIGSERIAL PRIMARY KEY,
      container TEXT NOT NULL,
      host TEXT NOT NULL DEFAULT 'local',
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await pool.query(`
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, 'admin')
    ON CONFLICT (email)
    DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', updated_at = NOW()
  `, [process.env.ADMIN_EMAIL.trim().toLowerCase(), hash]);
}

async function authenticateUser(email, password) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, role FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email.trim()]
  );
  if (!rows.length) return null;
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return null;
  return { id: rows[0].id, email: rows[0].email, role: rows[0].role };
}

async function listOptimizationHistory(limit = 100) {
  const { rows } = await pool.query(
    `SELECT container, host, action, status, created_at AS timestamp
     FROM optimization_history ORDER BY created_at DESC LIMIT $1`, [limit]
  );
  return rows.reverse();
}

async function saveOptimizationHistory(entry) {
  const { rows } = await pool.query(
    `INSERT INTO optimization_history (container, host, action, status)
     VALUES ($1, $2, $3, $4)
     RETURNING container, host, action, status, created_at AS timestamp`,
    [entry.container, entry.host || 'local', entry.action, entry.status || 'applied']
  );
  return rows[0];
}

module.exports = { pool, initDatabase, authenticateUser, listOptimizationHistory, saveOptimizationHistory };
