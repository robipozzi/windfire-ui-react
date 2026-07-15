# Make Keycloak auth work end-to-end now that Keycloak is HTTPS-only

## Context

Keycloak (on `raspberry01`) was switched to TLS-only (`--http-enabled=false`, confirmed in
`windfire-security/keycloak/deployment/raspberry/keycloak_scripts/start-keycloak.sh`), now
serving on `https://raspberry01:8443` with a **self-signed certificate** that is **not yet
trusted** by any client machine or the JVM. Two things depend on Keycloak and both will break
if only the URL scheme is changed without also fixing certificate trust:

1. **`windfire-ui-react`** — the browser SPA that authenticates directly against Keycloak's
   token endpoint (Resource Owner Password Credentials grant) from client-side `fetch()`.
   It's already been partially updated (`.env` now points at `https://raspberry01:8443`), but
   the Keycloak client's CORS ("Web Origins") config and the browsers' trust of the self-signed
   cert have not been addressed — without both, login will still fail (network/TLS error or
   CORS error), regardless of what `.env` says.
2. **`windfire-restaurants-backend`** — the Spring Boot resource server the SPA calls
   (`REACT_APP_RESTAURANTS_URL=https://raspberry02:8081/restaurants`). It validates JWTs by
   fetching Keycloak's OIDC metadata/JWKS from `issuer-uri`, which is still hardcoded to
   `http://...:8080`. Once Keycloak is HTTPS-only, this backend can no longer reach Keycloak at
   all for token validation — so even if the SPA logs in successfully, calls to the backend API
   will start failing with 401s.

The app runs identically in both "environments" via the same production Express server
(`server.js`), just on different hosts/ports (`https://localhost` locally, `PORT=8443` on
`raspberry02` per the README's non-root-deployment note) — so **one shared config** covers both,
it does not need per-environment files.

`windfire-ui-angular` (stale, confirmed not in use) is out of scope.

---

## 1. `windfire-ui-react` — browser SPA

- **`.env`** — already correct (`REACT_APP_KEYCLOAK_URL=https://raspberry01:8443`). No change.
- **`README.md`** — the "Keycloak Setup" table (client Valid Redirect URIs / Web Origins) and
  the "Keycloak Redirect URI Update for HTTPS" table still show only `http://localhost:3000`.
  Update both to list every real origin the app is served from:
  - Valid redirect URIs: `https://localhost/*`, `https://localhost:3000/*` (CRA dev-server mode),
    `https://raspberry02:8443/*`
  - Web origins: `https://localhost`, `https://localhost:3000`, `https://raspberry02:8443`

  Web Origins matters even though this app uses the password grant (not redirect flow): the
  browser's `fetch()` to the token endpoint is a cross-origin request, and Keycloak only sends
  `Access-Control-Allow-Origin` for origins listed in the client's Web Origins — without it,
  `res.json()` fails with a CORS error in the browser console even though curl/Postman would
  succeed.
- Add a new README section **"Trusting Keycloak's self-signed certificate"** documenting the
  browser/OS trust step from part 3 below — this is a functional requirement, not just docs,
  since `fetch()` to a host with an untrusted cert fails outright (`TypeError: Failed to fetch`),
  before CORS is even evaluated.
- **Keycloak Admin Console** (operational, on `raspberry01`): update the `windfire` realm's
  `windfire` client — set Valid Redirect URIs / Web Origins to the values above (currently only
  has the stale `http://localhost:3000` entries).

## 2. `windfire-restaurants-backend` — Spring Boot resource server

- **`src/main/resources/application.properties`** — change the issuer scheme:
  ```
  spring.security.oauth2.resourceserver.jwt.issuer-uri=https://${KEYCLOAK_SERVER}:${KEYCLOAK_SERVER_PORT}/realms/windfire
  ```
- **`setenv.sh`** — `DEFAULT_KEYCLOAK_PORT=8080` → `8443` (Keycloak no longer listens on 8080).
  Leave `KEYCLOAK_TLS_SERVER_PORT` as-is (still used by `test/requestKeycloakToken.sh`). Add a
  new variable next to the existing `DEFAULT_KEYCLOAK_TRUSTSTORE_DIR`/`DEFAULT_KEYCLOAK_CACERT_PEM`
  (which are currently defined but never wired up anywhere):
  ```
  DEFAULT_KEYCLOAK_TRUSTSTORE=keycloak.truststore.jks
  ```
  (a password will be collected interactively, matching the existing `inputKeystorePassword`
  pattern, not hardcoded).
- **`run-windfire-restaurants-backend.sh`** — add a `inputKeycloakTruststorePassword` prompt
  (mirrors `inputKeystorePassword`) and pass the JVM trust store to `java`:
  ```
  java -Djavax.net.ssl.trustStore=$DEFAULT_KEYCLOAK_TRUSTSTORE_DIR/$DEFAULT_KEYCLOAK_TRUSTSTORE \
       -Djavax.net.ssl.trustStorePassword=$KEYCLOAK_TRUSTSTORE_PWD \
       -jar target/$JAR_NAME-$VERSION.jar &
  ```
  Without this, the JVM's default trust store won't recognize Keycloak's self-signed CA and
  Spring's `NimbusJwtDecoder` will fail to fetch `/realms/windfire/.well-known/openid-configuration`
  over HTTPS at startup/first request.
- **Note (no action needed unless you want it cleaned up separately):**
  `application-prod.properties` is orphaned — nothing sets `spring.profiles.active=prod`
  anywhere in this repo — and already inconsistent (hardcoded `http://localhost:8080`, wrong
  realm `windfire-restaurants` instead of `windfire`). Leaving it untouched since it isn't wired
  into any run path; flagging so it doesn't look like a missed spot.

## 3. Certificate trust (what makes 1 and 2 actually work)

Keycloak's CA cert lives on `raspberry01` at
`~/dev/windfire-security/keycloak/security/tls/ca_keycloak.pem` (per
`DEFAULT_TLS_DIR`/`DEFAULT_CACERT_PEM` in
`windfire-security/keycloak/deployment/raspberry/keycloak_scripts/setenv.sh`, the script that
actually enabled TLS there). It needs to be retrieved once and distributed to every place that
talks to Keycloak:

```bash
# 1. Pull the CA cert from raspberry01
scp raspberry01:~/dev/windfire-security/keycloak/security/tls/ca_keycloak.pem /tmp/ca_keycloak.pem

# 2. PEM copy for curl/non-Java clients — this is the exact path
#    test/requestKeycloakToken.sh already expects (currently missing, so that
#    script's TLS option is currently broken too)
mkdir -p "$HOME/opt/keycloak/ssl/truststore"
cp /tmp/ca_keycloak.pem "$HOME/opt/keycloak/ssl/truststore/keycloak.truststore.pem"

# 3. JKS truststore for the Spring Boot backend's JVM
keytool -importcert -trustcacerts -noprompt \
  -alias ca_keycloak \
  -file /tmp/ca_keycloak.pem \
  -keystore "$HOME/opt/keycloak/ssl/truststore/keycloak.truststore.jks" \
  -storepass <choose a password, same one entered when running the backend>

# 4. Trust it for browsers on this (dev) Mac
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain /tmp/ca_keycloak.pem
```

For `raspberry02` (production host, if a browser is ever used directly on/against it) and any
other client machine, repeat step 4 with that OS's equivalent (Linux:
`cp ca_keycloak.pem /usr/local/share/ca-certificates/ca_keycloak.crt && sudo update-ca-certificates`,
plus Firefox's separate NSS store if Firefox is used there).

---

## Verification

1. `curl --cacert "$HOME/opt/keycloak/ssl/truststore/keycloak.truststore.pem" https://raspberry01:8443/realms/windfire/.well-known/openid-configuration` — confirms the CA trust chain is correct before touching the apps.
2. Start `windfire-restaurants-backend` (`./run-windfire-restaurants-backend.sh`) — confirm no SSL handshake errors in the log and that it successfully fetches Keycloak's JWKS at startup/first authenticated request.
3. Run `windfire-ui-react` locally (`./start.sh --dev` or `./start.sh`), log in through `LoginForm`, check the browser Network tab: token request to `https://raspberry01:8443/realms/windfire/protocol/openid-connect/token` should succeed with no TLS or CORS error, and a subsequent call to the restaurants API should return 200 (not 401).
4. Repeat step 3 against the `raspberry02:8443` deployment.