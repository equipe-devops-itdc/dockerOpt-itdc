const axios = require('axios');
const { createApp } = require('./src/app');
const { initDatabase } = require('./db');
const { startAlertMonitor } = require('./src/notifications/monitor');
const { PORT, PROMETHEUS_URL } = require('./src/config');

const app = createApp();

async function startServer() {
  try {
    await initDatabase();
    console.log('[DockerOpt] PostgreSQL connecté — compte administrateur synchronisé.');
  } catch (err) {
    console.error('[DockerOpt] PostgreSQL indisponible:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  DockerOpt Backend v1.0.0');
    console.log(`  Port: ${PORT}`);
    console.log(`  Prometheus: ${PROMETHEUS_URL}`);
    console.log('========================================');
  });

  let promReady = false;
  for (let i = 0; i < 12 && !promReady; i++) {
    try {
      await axios.get(`${PROMETHEUS_URL}/api/v1/status/config`);
      promReady = true;
      console.log('[DockerOpt] Prometheus connecté');
    } catch (e) {
      console.log(`[DockerOpt] Attente Prometheus... (${i + 1}/12)`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  if (!promReady) {
    console.warn('[DockerOpt] Prometheus non disponible au démarrage — les métriques restent indisponibles jusqu’à son rétablissement (aucune valeur synthétique).');
  }

  startAlertMonitor();
}

startServer();