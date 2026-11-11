import { vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from './App';

const kc = vi.hoisted(() => ({}));
vi.mock('keycloak-js', () => ({ default: vi.fn(function Keycloak() { return kc; }) }));

test('shows "Signing you in…" while Keycloak initializes, then the signed-in user', async () => {
  let finishInit;
  Object.assign(kc, {
    authenticated: true,
    token: 'access-1',
    tokenParsed: { name: 'Ada Lovelace', preferred_username: 'ada' },
    init: vi.fn(() => new Promise((resolve) => { finishInit = resolve; })),
    updateToken: vi.fn(() => Promise.resolve(false)),
    login: vi.fn(),
    logout: vi.fn(),
  });

  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');

  await act(async () => { finishInit(true); });
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument();
});
