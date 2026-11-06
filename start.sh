#!/bin/bash

set -e

# shellcheck source=commons.sh
source "$(dirname "${BASH_SOURCE[0]}")/commons.sh"

show_help() {
  echo -e "${BOLD}Usage: ./start.sh [OPTIONS]${NC}"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo -e "${BOLD}  --dev       Start the development server (npm run dev)${NC}"
  echo -e "${BOLD}              Uses HTTPS if the SSL_KEY_FILE and SSL_CRT_FILE files exist, HTTP otherwise${NC}"
  echo -e "${BOLD}  -h, --help  Show this help message and exit${NC}"
  echo ""
  echo -e "${BOLD}Default (no options): build the app and start the production HTTPS server.${NC}"
  echo -e "${BOLD}  SSL certificates are auto-generated if the SSL_KEY_FILE or SSL_CRT_FILE files are missing${NC}"
  echo -e "${BOLD}  (default: ssl/windfire-ui.key and ssl/windfire-ui.crt).${NC}"
}

DEV_MODE=false
for arg in "$@"; do
  case $arg in
    --dev) DEV_MODE=true ;;
    -h|--help) show_help; exit 0 ;;
  esac
done

echo -e "${CYAN}==> Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}==> node_modules not found, running npm install...${NC}"
  npm install
else
  echo -e "${GREEN}==> node_modules found, skipping install.${NC}"
fi

if [ "$DEV_MODE" = "true" ]; then
  echo -e "${YELLOW}==> Starting development server...${NC}"
  echo -e "${WHITE}    HTTPS is used if the SSL_KEY_FILE and SSL_CRT_FILE files exist, HTTP otherwise${NC}"
  npm run dev
else
  # Same precedence as server.js: shell environment, then .env, then the default filenames
  SSL_KEY_FILE="${SSL_KEY_FILE:-$(getEnvFileValue .env SSL_KEY_FILE)}"
  SSL_KEY_FILE="${SSL_KEY_FILE:-ssl/$WINDFIRE_SERVER_KEY}"
  SSL_CRT_FILE="${SSL_CRT_FILE:-$(getEnvFileValue .env SSL_CRT_FILE)}"
  SSL_CRT_FILE="${SSL_CRT_FILE:-ssl/$WINDFIRE_SERVER_CERTIFICATE}"

  # Ensure SSL certificates exist before building
  if [ ! -f "$SSL_KEY_FILE" ] || [ ! -f "$SSL_CRT_FILE" ]; then
    echo -e "${YELLOW}==> SSL certificates not found, generating certificates signed by the Windfire Root CA...${NC}"
    bash ssl/generate-ssl-cert.sh -e localhost -c "$(basename "$SSL_CRT_FILE")" -k "$(basename "$SSL_KEY_FILE")"
  else
    echo -e "${GREEN}==> SSL certificates found.${NC}"
  fi

  echo -e "${YELLOW}==> Building the application...${NC}"
  npm run build

  echo -e "${YELLOW}==> Starting production HTTPS server...${NC}"
  echo -e "${WHITE}    SSL_KEY_FILE=${SSL_KEY_FILE}${NC}"
  echo -e "${WHITE}    SSL_CRT_FILE=${SSL_CRT_FILE}${NC}"
  npm run serve
fi