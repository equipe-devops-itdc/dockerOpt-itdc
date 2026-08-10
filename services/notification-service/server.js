const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3003;
const SERVICE_NAME = 'notification-service';
const METRICS_PREFIX = 'notification_service_';

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

const notificationsSent = new promClient.Counter({
  name: `${METRICS_PREFIX}notifications_sent_total`,
  help: 'Total notifications sent',
  labelNames: ['type', 'status'],
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

// In-memory notifications store
const notifications = [
  { id: 1, userId: 1, type: 'email', subject: 'Welcome!', message: 'Welcome to our platform', read: false, createdAt: new Date().toISOString() },
  { id: 2, userId: 2, type: 'sms', subject: 'Order Update', message: 'Your order has shipped', read: true, createdAt: new Date().toISOString() }
];

// Routes
app.get('/notifications', (req, res) => {
  const start = Date.now();
  httpRequestsTotal.inc({ method: 'GET', path: '/notifications', status: 200 });
  
  const { userId } = req.query;
  let result = [...notifications];
  if (userId) result = result.filter(n => n.userId === parseInt(userId));
  
  res.json(result);
  httpRequestDuration.observe({ method: 'GET', path: '/notifications' }, (Date.now() - start) / 1000);
});

app.get('/notifications/:id', (req, res) => {
  const start = Date.now();
  const id = parseInt(req.params.id);
  const notification = notifications.find(n => n.id === id);
  if (!notification) {
    httpRequestsTotal.inc({ method: 'GET', path: '/notifications/:id', status: 404 });
    httpRequestDuration.observe({ method: 'GET', path: '/notifications/:id' }, (Date.now() - start) / 1000);
    return res.status(404).json({ error: 'Notification not found' });
  }
  httpRequestsTotal.inc({ method: 'GET', path: '/notifications/:id', status: 200 });
  httpRequestDuration.observe({ method: 'GET', path: '/notifications/:id' }, (Date.now() - start) / 1000);
  res.json(notification);
});

app.post('/notifications/send', (req, res) => {
  const start = Date.now();
  const { userId, type, subject, message } = req.body;
  
  const newNotification = {
    id: notifications.length + 1,
    userId,
    type: type || 'email',
    subject,
    message,
    read: false,
    createdAt: new Date().toISOString()
  };
  notifications.push(newNotification);
  notificationsSent.inc({ type: type || 'email', status: 'sent' });
  
  httpRequestsTotal.inc({ method: 'POST', path: '/notifications/send', status: 201 });
  httpRequestDuration.observe({ method: 'POST', path: '/notifications/send' }, (Date.now() - start) / 1000);
  res.status(201).json(newNotification);
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
});