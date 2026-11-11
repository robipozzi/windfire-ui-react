import { vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const kc = vi.hoisted(() => ({}));
vi.mock('keycloak-js', () => ({ default: vi.fn(function Keycloak() { return kc; }) }));

let AuthProvider, useAuth, SessionExpiredError, hasClientRole;

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function renderWithAuth() {
  const ref = {};
  function Probe() {
    Object.assign(ref, useAuth());
    return <div>{ref.isAuthenticated ? 'in' : 'out'}</div>;
  }
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('in');
  return ref;
}

beforeEach(async () => {
  // initKeycloak() memoizes its promise, so each test starts from fresh modules.
  vi.resetModules();
  Object.keys(kc).forEach((k) => delete kc[k]);
  Object.assign(kc, {
    authenticated: true,
    token: 'access-1',
    tokenParsed: { name: 'Ada Lovelace', preferred_username: 'ada', email: 'ada@example.com' },
    init: vi.fn(() => Promise.resolve(true)),
    updateToken: vi.fn(() => Promise.resolve(false)),
    login: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
  });
  ({ AuthProvider, useAuth, SessionExpiredError, hasClientRole } = await import('./AuthContext'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('initializes Keycloak once with the PKCE login-required options', async () => {
  await renderWithAuth();
  expect(kc.init).toHaveBeenCalledTimes(1);
  expect(kc.init).toHaveBeenCalledWith({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
});

test('shows "Signing you in…" until init resolves, then renders the app', async () => {
  const init = deferred();
  kc.init.mockReturnValue(init.promise);
  render(<AuthProvider><div>app</div></AuthProvider>);

  expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
  expect(screen.queryByText('app')).not.toBeInTheDocument();

  await act(async () => { init.resolve(true); });
  expect(screen.getByText('app')).toBeInTheDocument();
});

test('shows an error instead of the app when init fails', async () => {
  kc.init.mockReturnValue(Promise.reject(new Error('boom')));
  render(<AuthProvider><div>app</div></AuthProvider>);

  expect(await screen.findByText(/sign-in failed/i)).toBeInTheDocument();
  expect(screen.queryByText('app')).not.toBeInTheDocument();
});

test('exposes only name and preferred_username as user', async () => {
  const auth = await renderWithAuth();
  expect(auth.user).toEqual({ name: 'Ada Lovelace', preferred_username: 'ada' });
});

test('getToken refreshes ahead of expiry and returns the current token', async () => {
  kc.updateToken.mockImplementation(async () => { kc.token = 'access-2'; return true; });
  const auth = await renderWithAuth();

  let token;
  await act(async () => { token = await auth.getToken(); });

  expect(kc.updateToken).toHaveBeenCalledWith(30);
  expect(token).toBe('access-2');
});

test('getToken redirects to login and throws when the refresh fails', async () => {
  kc.updateToken.mockRejectedValue(new Error('refresh failed'));
  const auth = await renderWithAuth();

  await expect(auth.getToken()).rejects.toBeInstanceOf(SessionExpiredError);
  expect(kc.login).toHaveBeenCalledTimes(1);
});

test('logout returns to the app origin', async () => {
  const auth = await renderWithAuth();
  auth.logout();
  expect(kc.logout).toHaveBeenCalledWith({ redirectUri: window.location.origin });
});

test('keeps tokens out of web storage', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const auth = await renderWithAuth();
  await act(async () => { await auth.getToken(); });
  expect(setItem).not.toHaveBeenCalled();
});

test('hasApiRole reads client roles from the token', async () => {
  kc.tokenParsed.resource_access = { 'windfire-restaurants-api': { roles: ['restaurants-writer'] } };
  const auth = await renderWithAuth();
  expect(auth.hasApiRole('restaurants-writer')).toBe(true);
  expect(auth.hasApiRole('restaurants-admin')).toBe(false);
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
