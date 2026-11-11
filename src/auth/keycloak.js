import Keycloak from 'keycloak-js';

// The single Keycloak instance for the app. Tokens live only in this object's memory.
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

let initPromise;

// Authorization Code flow with PKCE. keycloak-js throws if init() runs twice
// (React StrictMode runs effects twice in development), so it runs once and the promise is shared.
export function initKeycloak() {
  initPromise ??= keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  });
  return initPromise;
}

export default keycloak;
