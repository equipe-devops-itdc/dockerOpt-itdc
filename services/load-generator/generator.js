// ============================================================
// Générateur de Charge pour tester DockerOpt
// Simule du trafic réaliste sur les microservices
// ============================================================

const axios = require('axios');
const API_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

const endpoints = [
  { method: 'GET', path: '/api/users', weight: 30 },
  { method: 'GET', path: '/api/products', weight: 40 },
  { method: 'GET', path: '/api/users/1', weight: 10 },
  { method: 'GET', path: '/api/products/2', weight: 10 },
  { method: 'GET', path: '/api/notifications', weight: 10 },
  { method: 'POST', path: '/api/users', weight: 5, body: () => ({
    name: `User_${Date.now()}`,
    email: `user${Date.now()}@test.com`,
    role: 'user'
  })},
  { method: 'POST', path: '/api/products', weight: 5, body: () => ({
    name: `Product_${Date.now()}`,
    category: ['electronics', 'home', 'sports'][Math.floor(Math.random() * 3)],
    price: Math.random() * 500 + 10,
    stock: Math.floor(Math.random() * 100)
  })},
  { method: 'POST', path: '/api/notifications/send', weight: 3, body: () => ({
    userId: Math.floor(Math.random() * 4) + 1,
    type: ['email', 'sms'][Math.floor(Math.random() * 2)],
    subject: 'Test Notification',
    message: 'This is a test notification'
  })}
];

// Weighted random selection
function pickEndpoint() {
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  for (const ep of endpoints) {
    random -= ep.weight;
    if (random <= 0) return ep;
  }
  return endpoints[0];
}

let requestCount = 0;
let successCount = 0;

async function sendRequest() {
  try {
    const ep = pickEndpoint();
    const url = `${API_URL}${ep.path}`;
    
    let response;
    if (ep.method === 'GET') {
      response = await axios.get(url, { timeout: 5000 });
    } else if (ep.method === 'POST') {
      const body = ep.body ? ep.body() : {};
      response = await axios.post(url, body, { timeout: 5000 });
    }
    
    requestCount++;
    successCount++;
    
    if (requestCount % 50 === 0) {
      console.log(`[LoadGen] ${requestCount} requêtes envoyées (${(successCount/requestCount*100).toFixed(1)}% succès)`);
    }
  } catch (err) {
    requestCount++;
    if (requestCount % 20 === 0) {
      console.log(`[LoadGen] Erreur: ${err.message}`);
    }
  }
}

async function start() {
  console.log('========================================');
  console.log('  DockerOpt - Générateur de Charge');
  console.log(`  API Gateway: ${API_URL}`);
  console.log('========================================');
  
  // Attendre que les services soient prêts
  console.log('[LoadGen] Attente des services...');
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    try {
      await axios.get(`${API_URL}/health`, { timeout: 2000 });
      ready = true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  if (!ready) {
    console.log('[LoadGen] Services non disponibles, démarrage quand même...');
  } else {
    console.log('[LoadGen] Services prêts !');
  }

  // Générer du trafic avec patterns variables
  console.log('[LoadGen] Début de la génération de trafic...');
  
  while (true) {
    // Période de pointe : plus de requêtes
    const peak = Math.random() > 0.7;
    const batchSize = peak ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 3) + 1;
    
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      promises.push(sendRequest());
    }
    await Promise.all(promises);
    
    // Pause variable (simule du trafic réaliste)
    const delay = peak ? Math.random() * 100 + 50 : Math.random() * 500 + 100;
    await new Promise(r => setTimeout(r, delay));
  }
}

start().catch(console.error);