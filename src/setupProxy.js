'use strict';

// CRA dev-server proxy (used by `npm start` / react-scripts start).
// Mirrors the production proxy in server.js so that mixed-content errors are
// avoided in development as well: the browser calls https://localhost/keycloak/*
// and this proxy forwards the request to Keycloak over HTTP on the backend.
//
// Activated when KEYCLOAK_PROXY_TARGET is set in .env, e.g.:
//   KEYCLOAK_PROXY_TARGET=http://raspberry01:8080

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const target = process.env.KEYCLOAK_PROXY_TARGET;
  if (target) {
    app.use(
      '/keycloak',
      createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { '^/keycloak': '' },
      })
    );
    console.log(`[setupProxy] Keycloak proxy enabled: /keycloak → ${target}`);
  }
};
