/**
 * @vitest-environment node
 */
'use strict';

const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const request = require('supertest');
const { createApp, validateConfig } = require('../server');

const INDEX_MARKER = '<!doctype html><title>windfire-spa-index</title>';
const ENV = {
  VITE_KEYCLOAK_URL:    'https://kc.example:8443',
  VITE_RESTAURANTS_URL: 'https://api.example',
};

let buildDir;
let app;

beforeAll(() => {
  buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'windfire-build-'));
  fs.writeFileSync(path.join(buildDir, 'index.html'), INDEX_MARKER);
  fs.mkdirSync(path.join(buildDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'assets', 'index-abc123.js'), 'console.log("ok");');
  app = createApp({ env: ENV, buildDir });
});

afterAll(() => {
  fs.rmSync(buildDir, { recursive: true, force: true });
});

describe('server.js', () => {
  test('GET / sets the security headers and serves index.html with no-store', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_MARKER);

    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://kc.example:8443 https://api.example");

    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('GET /keycloak/admin returns the SPA index, not a proxied response', async () => {
    const res = await request(app).get('/keycloak/admin');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toBe(INDEX_MARKER);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('hashed static assets get a long max-age', async () => {
    const res = await request(app).get('/assets/index-abc123.js');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('a relative VITE_KEYCLOAK_URL fails fast and points to .env', () => {
    const env = { ...ENV, VITE_KEYCLOAK_URL: '/keycloak' };
    expect(() => validateConfig(env)).toThrow(/\.env/);
    expect(() => createApp({ env, buildDir })).toThrow(/\.env/);
  });
});
