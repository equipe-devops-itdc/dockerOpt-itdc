const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = 'api-gateway';

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Service registry
const services = {
  users: {
    url: process.env.USER_SERVICE_URL || 'http://dockeropt-user-service:3001',
    prefix: '/users'
  },
  products: {
    url: process.env.PRODUCT_SERVICE_URL || 'http://dockeropt-product-service:3002',
    prefix: '/products'
  },
  notifications: {
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://dockeropt-notification-service:3003',
    prefix: '/notifications'
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: Object.keys(services)
  });
});

// Service info (doit être AVANT les routes proxy)
app.get('/api/services', (req, res) => {
  res.json({
    gateway: { name: SERVICE_NAME, status: 'running', port: PORT },
    services: Object.entries(services).map(([name, svc]) => ({
      name,
      url: svc.url,
      prefix: svc.prefix,
      status: 'registered'
    }))
  });
});

// Proxy routes
app.all('/api/:service', async (req, res) => {
  const targetService = services[req.params.service];
  if (!targetService) {
    return res.status(404).json({ 
      error: `Service '${req.params.service}' not found`,
      available: Object.keys(services)
    });
  }
  
  try {
    const url = targetService.url + targetService.prefix;
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      validateStatus: () => true
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({ error: `Service '${req.params.service}' unreachable: ${err.message}` });
  }
});

app.all('/api/:service/*', async (req, res) => {
  const targetService = services[req.params.service];
  if (!targetService) {
    return res.status(404).json({ 
      error: `Service '${req.params.service}' not found`,
      available: Object.keys(services)
    });
  }
  
  try {
    const subpath = req.params[0] || '';
    const url = targetService.url + targetService.prefix + (subpath ? '/' + subpath : '');
    
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
      validateStatus: () => true
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({ error: `Service '${req.params.service}' unreachable: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
  console.log(`[${SERVICE_NAME}] Routes:`);
  Object.entries(services).forEach(([name, svc]) => {
    console.log(`  /api/${name} -> ${svc.url}${svc.prefix}`);
  });
});