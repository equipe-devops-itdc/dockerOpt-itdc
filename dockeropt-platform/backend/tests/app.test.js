const request = require('supertest');
const { createApp } = require('../src/app');

describe('DockerOpt Backend API', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('GET /health doit retourner un statut HTTP valide', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/);

    expect([200, 204]).toContain(response.statusCode);
  });
});
