/**
 * @vitest-environment node
 */
'use strict';

// In the public profile Keycloak (auth.<domain>) sits behind Cloudflare Access: the token
// calls must carry the CF_Authorization cookie, so keycloak-js must send them with
// credentials: 'include'. This guards against a keycloak-js upgrade dropping it.
const fs   = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'node_modules', 'keycloak-js', 'lib', 'keycloak.js'),
  'utf8'
);

const methodBody = (name) => {
  const start = source.indexOf(`async #${name} (`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n  }\n', start);
  return source.slice(start, end);
};

describe('keycloak-js token requests', () => {
  test.each(['fetchAccessToken', 'fetchRefreshToken'])('%s sends credentials', (name) => {
    expect(methodBody(name)).toContain("credentials: 'include'");
  });
});
