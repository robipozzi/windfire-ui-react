import { render, screen } from '@testing-library/react';
import App from './App';

test('renders windfire architecture heading', () => {
  render(<App />);
  const heading = screen.getByText(/windfire-ui-react/i);
  expect(heading).toBeInTheDocument();
});

test('renders architecture diagram subtitle', () => {
  render(<App />);
  const subtitle = screen.getByText(/windfire system architecture/i);
  expect(subtitle).toBeInTheDocument();
});
