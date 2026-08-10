const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3002;
const SERVICE_NAME = 'product-service';
const METRICS_PREFIX = 'product_service_';

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

// In-memory product store
const products = [
  { id: 1, name: 'Laptop Pro', category: 'electronics', price: 1299.99, stock: 50 },
  { id: 2, name: 'Wireless Mouse', category: 'electronics', price: 29.99, stock: 200 },
  { id: 3, name: 'Coffee Maker', category: 'home', price: 79.99, stock: 75 },
  { id: 4, name: 'Running Shoes', category: 'sports', price: 89.99, stock: 120 },
  { id: 5, name: 'Desk Lamp', category: 'home', price: 45.00, stock: 90 },
  { id: 6, name: 'USB-C Hub', category: 'electronics', price: 34.99, stock: 150 }
];

// Routes
app.get('/products', (req, res) => {
  const start = Date.now();
  httpRequestsTotal.inc({ method: 'GET', path: '/products', status: 200 });
  
  let result = [...products];
  const { category, minPrice, maxPrice } = req.query;
  if (category) result = result.filter(p => p.category === category);
  if (minPrice) result = result.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter(p => p.price <= parseFloat(maxPrice));
  
  res.json(result);
  httpRequestDuration.observe({ method: 'GET', path: '/products' }, (Date.now() - start) / 1000);
});

app.get('/products/:id', (req, res) => {
  const start = Date.now();
  const id = parseInt(req.params.id);
  const product = products.find(p => p.id === id);
  if (!product) {
    httpRequestsTotal.inc({ method: 'GET', path: '/products/:id', status: 404 });
    httpRequestDuration.observe({ method: 'GET', path: '/products/:id' }, (Date.now() - start) / 1000);
    return res.status(404).json({ error: 'Product not found' });
  }
  httpRequestsTotal.inc({ method: 'GET', path: '/products/:id', status: 200 });
  httpRequestDuration.observe({ method: 'GET', path: '/products/:id' }, (Date.now() - start) / 1000);
  res.json(product);
});

app.post('/products', (req, res) => {
  const start = Date.now();
  const { name, category, price, stock } = req.body;
  const newProduct = {
    id: products.length + 1,
    name,
    category,
    price,
    stock: stock || 0
  };
  products.push(newProduct);
  httpRequestsTotal.inc({ method: 'POST', path: '/products', status: 201 });
  httpRequestDuration.observe({ method: 'POST', path: '/products' }, (Date.now() - start) / 1000);
  res.status(201).json(newProduct);
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
});