// Returns the normalised href of `value` only if it is an absolute http(s) URL,
// otherwise null. Never throws.
export function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
