import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the login form when not authenticated', () => {
  sessionStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
});
