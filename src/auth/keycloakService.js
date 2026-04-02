const KEYCLOAK_URL = process.env.REACT_APP_KEYCLOAK_URL;
const REALM = process.env.REACT_APP_KEYCLOAK_REALM;
const CLIENT_ID = process.env.REACT_APP_KEYCLOAK_CLIENT_ID;

const tokenUrl = () =>
  `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;

export async function login(username, password) {
  // ##### START - Debug logging - remove in production
  console.log('===> (keycloakService) - Attempting login with:', { username, password: '******' });
  console.log('===> (keycloakService) - Keycloak URL:', KEYCLOAK_URL);
  console.log('===> (keycloakService) - Realm:', REALM);
  console.log('===> (keycloakService) - Client ID:', CLIENT_ID);
  console.log('===> (keycloakService) - tokenUrl:', tokenUrl);
  // ##### END - Debug logging - remove in production
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username,
      password,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || 'Authentication failed');
  }
  return res.json();
}

export async function logout(refreshToken) {
  await fetch(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/logout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }),
    }
  ).catch(() => {});
}

export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}