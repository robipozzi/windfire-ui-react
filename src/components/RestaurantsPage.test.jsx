import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import RestaurantsPage from './RestaurantsPage';

const kc = vi.hoisted(() => ({}));
vi.mock('keycloak-js', () => ({ default: vi.fn(function Keycloak() { return kc; }) }));

const RESTAURANT = {
  id: '1',
  name: 'La Perla',
  address: { street: 'Via Carrobbio 19', zipCode: '21100', city: 'Varese', province: 'VA', region: 'Lombardia', country: 'Italy' },
  cuisine: 'Pesce',
};

function signInWithRoles(roles) {
  kc.tokenParsed = {
    preferred_username: 'ada',
    resource_access: { 'windfire-restaurants-api': { roles } },
  };
}

async function renderPage() {
  render(<AuthProvider><RestaurantsPage /></AuthProvider>);
  await screen.findByText(RESTAURANT.name);
}

beforeEach(() => {
  Object.assign(kc, {
    authenticated: true,
    token: 'access-1',
    tokenParsed: {},
    init: vi.fn(() => Promise.resolve(true)),
    updateToken: vi.fn(() => Promise.resolve(false)),
    login: vi.fn(),
    logout: vi.fn(),
  });
  vi.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([RESTAURANT]),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('calls getToken before fetching and sends the token as a bearer header', async () => {
  signInWithRoles(['restaurants-reader']);
  await renderPage();

  expect(kc.updateToken).toHaveBeenCalledWith(30);
  expect(kc.updateToken.mock.invocationCallOrder[0])
    .toBeLessThan(fetch.mock.invocationCallOrder[0]);
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer access-1');
});

test('writers see Add, the Actions column and Delete', async () => {
  signInWithRoles(['restaurants-reader', 'restaurants-writer']);
  await renderPage();

  expect(screen.getByRole('button', { name: '+ Add Restaurant' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
  expect(screen.getByTitle('Delete restaurant')).toBeInTheDocument();
});

test('readers see the list and details but no write actions', async () => {
  signInWithRoles(['restaurants-reader']);
  await renderPage();

  expect(screen.queryByRole('button', { name: '+ Add Restaurant' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  expect(screen.queryByTitle('Delete restaurant')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: RESTAURANT.name }));
  expect(screen.getByRole('heading', { name: RESTAURANT.name })).toBeInTheDocument();
});

test('an unreachable API shows a clear message instead of the browser text', async () => {
  signInWithRoles(['restaurants-reader']);
  global.fetch.mockImplementation(() => Promise.reject(new TypeError('Load failed')));
  render(<AuthProvider><RestaurantsPage /></AuthProvider>);

  expect(await screen.findByText(
    'Failed to load restaurants: Cannot reach the Restaurants API (network, certificate or CORS error).'
  )).toBeInTheDocument();
  expect(screen.queryByText(/Load failed/)).not.toBeInTheDocument();
});
