import { safeHttpUrl } from './safeUrl';

test('accepts https URLs', () => {
  expect(safeHttpUrl('https://example.com')).toBe('https://example.com/');
});

test('accepts http URLs', () => {
  expect(safeHttpUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
});

test('rejects javascript: URLs', () => {
  expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
});

test('rejects data: URLs', () => {
  expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
});

test('rejects mixed-case javascript: URLs', () => {
  expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull();
});

test('handles leading whitespace', () => {
  expect(safeHttpUrl('   https://example.com')).toBe('https://example.com/');
  expect(safeHttpUrl('  javascript:alert(1)')).toBeNull();
});

test('rejects an empty string', () => {
  expect(safeHttpUrl('')).toBeNull();
});

test('returns null for null and undefined without throwing', () => {
  expect(safeHttpUrl(undefined)).toBeNull();
  expect(safeHttpUrl(null)).toBeNull();
});
