#!/bin/bash

set -e

# shellcheck source=commons.sh
source "$(dirname "${BASH_SOURCE[0]}")/commons.sh"

show_help() {
  echo -e "${BOLD}Usage: ./run.sh [OPTIONS]${NC}"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo -e "${BOLD}  --dev       Start the development server (npm start)${NC}"
  echo -e "${BOLD}              HTTPS is enabled if HTTPS=true, SSL_CRT_FILE, and SSL_KEY_FILE are set in .env${NC}"
  echo -e "${BOLD}  -h, --help  Show this help message and exit${NC}"
  echo ""
  echo -e "${BOLD}Default (no options): build the app and start the production HTTPS server.${NC}"
  echo -e "${BOLD}  SSL certificates are auto-generated if ssl/key.pem or ssl/cert.pem are missing.${NC}"
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
  echo -e "${WHITE}    HTTPS will be enabled if HTTPS=true, SSL_CRT_FILE, and SSL_KEY_FILE are set in .env${NC}"
  npm start
else
  # Ensure SSL certificates exist before building
  if [ ! -f "ssl/key.pem" ] || [ ! -f "ssl/cert.pem" ]; then
    echo -e "${YELLOW}==> SSL certificates not found, generating self-signed certificates...${NC}"
    bash ssl/generate-ssl.sh
  else
    echo -e "${GREEN}==> SSL certificates found.${NC}"
  fi

  echo -e "${YELLOW}==> Building the application...${NC}"
  npm run build

  echo -e "${YELLOW}==> Starting production HTTPS server...${NC}"
  echo -e "${WHITE}    SSL_KEY_FILE=${SSL_KEY_FILE:-ssl/key.pem}${NC}"
  echo -e "${WHITE}    SSL_CRT_FILE=${SSL_CRT_FILE:-ssl/cert.pem}${NC}"
  npm run serve
fi