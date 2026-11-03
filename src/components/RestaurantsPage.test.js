import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import RestaurantsPage from './RestaurantsPage';

const RESTAURANT = {
  id: '1',
  name: 'La Perla',
  address: { street: 'Via Carrobbio 19', zipCode: '21100', city: 'Varese', province: 'VA', region: 'Lombardia', country: 'Italy' },
  cuisine: 'Pesce',
};

function storeSessionWithRoles(roles) {
  const user = {
    exp: Math.floor(Date.now() / 1000) + 300,
    resource_access: { 'windfire-restaurants-api': { roles } },
  };
  const b64 = btoa(JSON.stringify(user)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem('wf_auth', JSON.stringify({
    tokens: { access_token: `header.${b64}.signature`, refresh_token: 'refresh-1' },
    user,
  }));
}

async function renderPage() {
  render(<AuthProvider><RestaurantsPage /></AuthProvider>);
  await screen.findByText(RESTAURANT.name);
}

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([RESTAURANT]),
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('writers see Add, the Actions column and Delete', async () => {
  storeSessionWithRoles(['restaurants-reader', 'restaurants-writer']);
  await renderPage();

  expect(screen.getByRole('button', { name: '+ Add Restaurant' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
  expect(screen.getByTitle('Delete restaurant')).toBeInTheDocument();
});

test('readers see the list and details but no write actions', async () => {
  storeSessionWithRoles(['restaurants-reader']);
  await renderPage();

  expect(screen.queryByRole('button', { name: '+ Add Restaurant' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  expect(screen.queryByTitle('Delete restaurant')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: RESTAURANT.name }));
  expect(screen.getByRole('heading', { name: RESTAURANT.name })).toBeInTheDocument();
});

test('an unreachable API shows a clear message instead of the browser text', async () => {
  storeSessionWithRoles(['restaurants-reader']);
  global.fetch.mockImplementation(() => Promise.reject(new TypeError('Load failed')));
  render(<AuthProvider><RestaurantsPage /></AuthProvider>);

  expect(await screen.findByText(
    'Failed to load restaurants: Cannot reach the Restaurants API (network, certificate or CORS error).'
  )).toBeInTheDocument();
  expect(screen.queryByText(/Load failed/)).not.toBeInTheDocument();
});
