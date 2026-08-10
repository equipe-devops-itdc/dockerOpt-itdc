const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = 'user-service';
const METRICS_PREFIX = 'user_service_';

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: METRICS_PREFIX });

const httpRequestsTotal = new promClient.Counter({
  name: `${METRICS_PREFIX}http_requests_total`,
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// In-memory user store
const users = [
  { id: 1, name: 'Alice Dupont', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Martin', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Durand', email: 'charlie@example.com', role: 'user' },
  { id: 4, name: 'Diana Lambert', email: 'diana@example.com', role: 'moderator' }
];

// Routes
app.get('/users', (req, res) => {
  const start = Date.now();
  httpRequestsTotal.inc({ method: 'GET', path: '/users', status: 200 });
  res.json(users);
  httpRequestDuration.observe({ method: 'GET', path: '/users' }, (Date.now() - start) / 1000);
});

app.get('/users/:id', (req, res) => {
  const start = Date.now();
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  if (!user) {
    httpRequestsTotal.inc({ method: 'GET', path: '/users/:id', status: 404 });
    httpRequestDuration.observe({ method: 'GET', path: '/users/:id' }, (Date.now() - start) / 1000);
    return res.status(404).json({ error: 'User not found' });
  }
  httpRequestsTotal.inc({ method: 'GET', path: '/users/:id', status: 200 });
  httpRequestDuration.observe({ method: 'GET', path: '/users/:id' }, (Date.now() - start) / 1000);
  res.json(user);
});

app.post('/users', (req, res) => {
  const start = Date.now();
  const { name, email, role } = req.body;
  const newUser = {
    id: users.length + 1,
    name,
    email,
    role: role || 'user'
  };
  users.push(newUser);
  httpRequestsTotal.inc({ method: 'POST', path: '/users', status: 201 });
  httpRequestDuration.observe({ method: 'POST', path: '/users' }, (Date.now() - start) / 1000);
  res.status(201).json(newUser);
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
});