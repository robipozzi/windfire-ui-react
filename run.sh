#!/bin/bash

set -e

show_help() {
  echo "Usage: ./run.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --dev       Start the development server (npm start)"
  echo "              HTTPS is enabled if HTTPS=true, SSL_CRT_FILE, and SSL_KEY_FILE are set in .env"
  echo "  -h, --help  Show this help message and exit"
  echo ""
  echo "Default (no options): build the app and start the production HTTPS server."
  echo "  SSL certificates are auto-generated if ssl/key.pem or ssl/cert.pem are missing."
}

DEV_MODE=false
for arg in "$@"; do
  case $arg in
    --dev) DEV_MODE=true ;;
    -h|--help) show_help; exit 0 ;;
  esac
done

echo "==> Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "==> node_modules not found, running npm install..."
  npm install
else
  echo "==> node_modules found, skipping install."
fi

if [ "$DEV_MODE" = "true" ]; then
  echo "==> Starting development server..."
  echo "    HTTPS will be enabled if HTTPS=true, SSL_CRT_FILE, and SSL_KEY_FILE are set in .env"
  npm start
else
  # Ensure SSL certificates exist before building
  if [ ! -f "ssl/key.pem" ] || [ ! -f "ssl/cert.pem" ]; then
    echo "==> SSL certificates not found, generating self-signed certificates..."
    bash ssl/generate-ssl.sh
  else
    echo "==> SSL certificates found."
  fi

  echo "==> Building the application..."
  npm run build

  echo "==> Starting production HTTPS server..."
  echo "    SSL_KEY_FILE=${SSL_KEY_FILE:-ssl/key.pem}"
  echo "    SSL_CRT_FILE=${SSL_CRT_FILE:-ssl/cert.pem}"
  npm run serve
fi
