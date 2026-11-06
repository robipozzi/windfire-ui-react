import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server TLS: same settings and defaults as server.js. Falls back to HTTP
// when the files are missing (create them with ssl/generate-ssl-cert.sh).
const devHttps = (env) => {
  const keyFile = path.resolve(env.SSL_KEY_FILE || 'ssl/windfire-ui.key');
  const certFile = path.resolve(env.SSL_CRT_FILE || 'ssl/windfire-ui.crt');
  if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
    console.warn(`SSL files not found (${keyFile}, ${certFile}): the dev server will use HTTP`);
    return undefined;
  }
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
};

export default defineConfig(({ command, mode }) => {
  // The empty prefix loads SSL_* for this config only: the client bundle still sees just VITE_*.
  // Shell variables take precedence over .env.
  const env = loadEnv(mode, process.cwd(), '');
  const isDevServer = command === 'serve' && !process.env.VITEST;

  return {
    plugins: [react()],
    build: { outDir: 'dist' },
    server: {
      // Keycloak redirect URIs/web origins and the backend CORS origin list localhost:3000
      port: 3000,
      strictPort: true,
      https: isDevServer ? devHttps(env) : undefined,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: 'src/setupTests.js',
      include: ['src/**/*.test.{js,jsx}'],
    },
  };
});
