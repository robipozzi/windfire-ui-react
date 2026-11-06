import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, SessionExpiredError, hasClientRole } from './AuthContext';

const API_URL = 'https://api.example/restaurants';

function makeToken(expOffsetSeconds, extra = {}) {
  const payload = { exp: Math.floor(Date.now() / 1000) + expOffsetSeconds, ...extra };
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${b64}.signature`;
}

function storeSession(accessToken, refreshToken = 'refresh-1') {
  sessionStorage.setItem('wf_auth', JSON.stringify({
    tokens: { access_token: accessToken, refresh_token: refreshToken },
    user: {},
  }));
}

function jsonResponse(status, body = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  });
}

const isTokenCall = ([url]) => String(url).includes('/protocol/openid-connect/token');

function renderWithAuth() {
  const ref = {};
  function Probe() {
    Object.assign(ref, useAuth());
    return <div>{ref.isAuthenticated ? 'in' : 'out'}</div>;
  }
  render(<AuthProvider><Probe /></AuthProvider>);
  return ref;
}

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(global, 'fetch');
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('refreshes an expired access token before calling the API', async () => {
  const fresh = makeToken(300);
  storeSession(makeToken(-10));
  fetch.mockImplementation((url) =>
    String(url).includes('/token')
      ? jsonResponse(200, { access_token: fresh, refresh_token: 'refresh-2' })
      : jsonResponse(200, []));

  const auth = renderWithAuth();
  await act(async () => { await auth.authFetch(API_URL); });

  const [tokenCall, apiCall] = fetch.mock.calls;
  expect(isTokenCall(tokenCall)).toBe(true);
  expect(tokenCall[1].body.get('grant_type')).toBe('refresh_token');
  expect(tokenCall[1].body.get('refresh_token')).toBe('refresh-1');
  expect(apiCall[0]).toBe(API_URL);
  expect(apiCall[1].headers.Authorization).toBe(`Bearer ${fresh}`);
  expect(JSON.parse(sessionStorage.getItem('wf_auth')).tokens.refresh_token).toBe('refresh-2');
});

test('forces a refresh and retries once when the API returns 401', async () => {
  const fresh = makeToken(300);
  storeSession(makeToken(300));
  fetch
    .mockImplementationOnce(() => jsonResponse(401))
    .mockImplementationOnce(() => jsonResponse(200, { access_token: fresh, refresh_token: 'refresh-2' }))
    .mockImplementationOnce(() => jsonResponse(200, []));

  const auth = renderWithAuth();
  let res;
  await act(async () => { res = await auth.authFetch(API_URL); });

  expect(res.status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[2][1].headers.Authorization).toBe(`Bearer ${fresh}`);
});

test('clears the session when the refresh fails', async () => {
  storeSession(makeToken(-10));
  fetch.mockImplementation(() => jsonResponse(400, { error_description: 'Session not active' }));

  const auth = renderWithAuth();
  expect(screen.getByText('in')).toBeInTheDocument();

  await act(async () => {
    await expect(auth.authFetch(API_URL)).rejects.toBeInstanceOf(SessionExpiredError);
  });

  await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());
  expect(auth.sessionMessage).toMatch(/session has expired/i);
  expect(sessionStorage.getItem('wf_auth')).toBeNull();
});

test('concurrent requests share a single refresh', async () => {
  storeSession(makeToken(-10));
  fetch.mockImplementation((url) =>
    String(url).includes('/token')
      ? jsonResponse(200, { access_token: makeToken(300), refresh_token: 'refresh-2' })
      : jsonResponse(200, []));

  const auth = renderWithAuth();
  await act(async () => {
    await Promise.all([auth.authFetch(API_URL), auth.authFetch(API_URL)]);
  });

  expect(fetch.mock.calls.filter(isTokenCall)).toHaveLength(1);
  expect(fetch.mock.calls.filter((c) => !isTokenCall(c))).toHaveLength(2);
});

describe('hasClientRole', () => {
  const CLIENT = 'windfire-restaurants-api';

  test('true when the role is granted on the client', () => {
    const user = { resource_access: { [CLIENT]: { roles: ['restaurants-reader', 'restaurants-writer'] } } };
    expect(hasClientRole(user, CLIENT, 'restaurants-writer')).toBe(true);
  });

  test('false when the role is granted on another client', () => {
    const user = { resource_access: { 'other-client': { roles: ['restaurants-writer'] } } };
    expect(hasClientRole(user, CLIENT, 'restaurants-writer')).toBe(false);
  });

  test('false for a realm-only role', () => {
    expect(hasClientRole({ realm_access: { roles: ['restaurants-writer'] } }, CLIENT, 'restaurants-writer')).toBe(false);
  });

  test('false for missing or malformed claims', () => {
    expect(hasClientRole(null, CLIENT, 'restaurants-writer')).toBe(false);
    expect(hasClientRole({}, CLIENT, 'restaurants-writer')).toBe(false);
    expect(hasClientRole({ resource_access: { [CLIENT]: 'restaurants-writer' } }, CLIENT, 'restaurants-writer')).toBe(false);
    expect(hasClientRole({ resource_access: { [CLIENT]: { roles: 'restaurants-writer' } } }, CLIENT, 'restaurants-writer')).toBe(false);
  });
});
