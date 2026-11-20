'use strict';

require('dotenv').config(); // load .env into process.env (e.g. VITE_KEYCLOAK_URL)

const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const helmet  = require('helmet');

// ---------------------------------------------------------------------------
// Configuration validation
// Keycloak is served over HTTPS and the browser talks to it directly, so
// VITE_KEYCLOAK_URL must be an absolute URL. A relative value such as
// /keycloak belonged to the removed /keycloak proxy and is rejected at startup.
// VITE_RESTAURANTS_URL may be an absolute URL or a same-origin path such as
// /restaurants (public profile: the API is routed on the UI's own hostname).
// A protocol-relative //host value would point to another origin, so it is
// rejected like any other value that is neither.
// ---------------------------------------------------------------------------
const originOf = (url) => {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin; // opaque origins (e.g. foo:bar) have none
  } catch {
    return null;
  }
};

const isSameOriginPath = (url) => url.startsWith('/') && !url.startsWith('//');

const validateConfig = (env) => {
  const keycloakUrl = env.VITE_KEYCLOAK_URL || '';
  if (keycloakUrl.startsWith('/')) {
    throw new Error(
      `VITE_KEYCLOAK_URL is relative ("${keycloakUrl}"). The /keycloak proxy has been removed: ` +
      'set VITE_KEYCLOAK_URL in .env to the absolute https:// URL of Keycloak ' +
      '(e.g. https://raspberry01:8443), then rebuild and restart.'
    );
  }

  const restaurantsUrl = env.VITE_RESTAURANTS_URL || '';
  if (restaurantsUrl && !isSameOriginPath(restaurantsUrl) && !originOf(restaurantsUrl)) {
    throw new Error(
      `VITE_RESTAURANTS_URL is neither an absolute URL nor a same-origin path ("${restaurantsUrl}"): ` +
      'set VITE_RESTAURANTS_URL in .env to an https:// URL (e.g. https://raspberry02:8081/restaurants) ' +
      'or to a path on this origin (e.g. /restaurants), then rebuild and restart.'
    );
  }
};

// Vite puts content-hashed bundles under dist/assets/, so they can be cached forever
const isHashedAsset = (filePath, buildDir) =>
  path.relative(buildDir, filePath).split(path.sep)[0] === 'assets';

// ---------------------------------------------------------------------------
// Express app — serves the React production build
// ---------------------------------------------------------------------------
const createApp = ({ env = process.env, buildDir = path.join(__dirname, 'dist') } = {}) => {
  validateConfig(env);

  const app = express();
  app.disable('x-powered-by');

  // -------------------------------------------------------------------------
  // Security headers
  // connect-src allows the origins of the Keycloak and Restaurants API URLs,
  // read once at startup; a same-origin Restaurants path is covered by 'self'.
  // form-action allows Keycloak for the login and logout redirects.
  // No frame-src: keycloak-js runs with checkLoginIframe off.
  // -------------------------------------------------------------------------
  const keycloakOrigin = originOf(env.VITE_KEYCLOAK_URL);
  const restaurantsUrl = env.VITE_RESTAURANTS_URL || '';
  const restaurantsOrigin = isSameOriginPath(restaurantsUrl) ? null : originOf(restaurantsUrl);
  const connectSrc = ["'self'", ...new Set([
    keycloakOrigin,
    restaurantsOrigin,
  ].filter(Boolean))];
  const formAction = ["'self'", keycloakOrigin].filter(Boolean);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'"],
        imgSrc:         ["'self'", 'data:'],
        connectSrc,
        formAction,
        frameAncestors: ["'none'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
      },
    },
    strictTransportSecurity: { maxAge: 31536000 },
    xContentTypeOptions:     true,
    referrerPolicy:          { policy: 'no-referrer' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
  }));

  // helmet has no option for Permissions-Policy
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Serve static assets (JS bundles, CSS, images, etc.).
  // index.html is never served from here (index: false) so it always goes
  // through the fallback below with Cache-Control: no-store.
  app.use(express.static(buildDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (isHashedAsset(filePath, buildDir)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));

  // Fallback: return index.html for all routes (React Router support)
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(buildDir, 'index.html'));
  });

  return app;
};

// ---------------------------------------------------------------------------
// Startup: HTTPS server + optional HTTP -> HTTPS redirect
// ---------------------------------------------------------------------------
const main = () => {
  const SSL_KEY_FILE  = process.env.SSL_KEY_FILE       || path.join(__dirname, 'ssl', 'windfire-ui.key');
  const SSL_CRT_FILE  = process.env.SSL_CRT_FILE       || path.join(__dirname, 'ssl', 'windfire-ui.crt');
  const PORT          = parseInt(process.env.PORT      || '443', 10);
  const HTTP_PORT     = parseInt(process.env.HTTP_PORT || '80',  10);
  const HTTP_REDIRECT = process.env.HTTP_REDIRECT !== 'false';

  let app;
  try {
    app = createApp();
  } catch (err) {
    console.error('ERROR: Invalid configuration.');
    console.error('       ' + err.message);
    process.exit(1);
  }

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
    console.error('       Run ssl/generate-ssl-cert.sh to create self-signed certificates for development.');
    process.exit(1);
  }

  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`HTTPS server listening on port ${PORT}`);
  });

  if (HTTP_REDIRECT) {
    const redirectApp = express();
    redirectApp.disable('x-powered-by');

    redirectApp.use((req, res) => {
      const host       = req.headers.host ? req.headers.host.replace(/:\d+$/, '') : 'localhost';
      const portSuffix = PORT === 443 ? '' : `:${PORT}`;
      res.redirect(301, `https://${host}${portSuffix}${req.url}`);
    });

    http.createServer(redirectApp).listen(HTTP_PORT, () => {
      console.log(`HTTP redirect server listening on port ${HTTP_PORT} -> HTTPS port ${PORT}`);
    });
  }
};

if (require.main === module) {
  main();
}

module.exports = { createApp, validateConfig };
