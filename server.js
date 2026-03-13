'use strict';

require('dotenv').config(); // load .env into process.env (e.g. KEYCLOAK_PROXY_TARGET)

const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------
const SSL_KEY_FILE       = process.env.SSL_KEY_FILE       || path.join(__dirname, 'ssl', 'key.pem');
const SSL_CRT_FILE       = process.env.SSL_CRT_FILE       || path.join(__dirname, 'ssl', 'cert.pem');
const PORT               = parseInt(process.env.PORT      || '443', 10);
const HTTP_PORT          = parseInt(process.env.HTTP_PORT || '80',  10);
const HTTP_REDIRECT      = process.env.HTTP_REDIRECT !== 'false';
const KEYCLOAK_PROXY_TARGET = process.env.KEYCLOAK_PROXY_TARGET || null;

// ---------------------------------------------------------------------------
// Validate and load SSL certificates
// ---------------------------------------------------------------------------
let sslOptions;
try {
  sslOptions = {
    key:  fs.readFileSync(path.resolve(SSL_KEY_FILE)),
    cert: fs.readFileSync(path.resolve(SSL_CRT_FILE)),
  };
} catch (err) {
  console.error('ERROR: Failed to read SSL certificate files.');
  console.error('       SSL_KEY_FILE :', SSL_KEY_FILE);
  console.error('       SSL_CRT_FILE :', SSL_CRT_FILE);
  console.error('       Cause        :', err.message);
  console.error('');
  console.error('       Run ssl/generate-ssl.sh to create self-signed certificates for development.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Express app — serves the React production build
// ---------------------------------------------------------------------------
const app      = express();
const buildDir = path.join(__dirname, 'build');

// ---------------------------------------------------------------------------
// Solution 1: Proxy /keycloak/* → Keycloak server (HTTP on backend, HTTPS on frontend)
// Activated when KEYCLOAK_PROXY_TARGET is set in the environment.
// Prevents mixed-content errors when the React app is served over HTTPS but
// Keycloak is only available over HTTP.
// ---------------------------------------------------------------------------
if (KEYCLOAK_PROXY_TARGET) {
  app.use('/keycloak', createProxyMiddleware({
    target: KEYCLOAK_PROXY_TARGET,
    changeOrigin: true,
    pathRewrite: { '^/keycloak': '' },
  }));
  console.log(`Keycloak proxy enabled: /keycloak → ${KEYCLOAK_PROXY_TARGET}`);
}

// Serve static assets (JS bundles, CSS, images, etc.)
app.use(express.static(buildDir));

// Fallback: return index.html for all routes (React Router support)
app.get('*', (_req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

// ---------------------------------------------------------------------------
// HTTPS server
// ---------------------------------------------------------------------------
const httpsServer = https.createServer(sslOptions, app);

httpsServer.listen(PORT, () => {
  console.log(`HTTPS server listening on port ${PORT}`);
});

// ---------------------------------------------------------------------------
// Optional HTTP -> HTTPS redirect server
// ---------------------------------------------------------------------------
if (HTTP_REDIRECT) {
  const redirectApp = express();

  redirectApp.use((req, res) => {
    const host       = req.headers.host ? req.headers.host.replace(/:\d+$/, '') : 'localhost';
    const portSuffix = PORT === 443 ? '' : `:${PORT}`;
    res.redirect(301, `https://${host}${portSuffix}${req.url}`);
  });

  const httpServer = http.createServer(redirectApp);

  httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP redirect server listening on port ${HTTP_PORT} -> HTTPS port ${PORT}`);
  });
}