#!/bin/bash

# =============================================================================
# generate-ssl.sh
#
# Generates a self-signed TLS private key and certificate for local
# development and testing purposes.
#
# Output files (written to the same directory as this script):
#   key.pem  — RSA 4096-bit private key
#   cert.pem — Self-signed X.509 certificate (valid 365 days)
#
# NOTE: Self-signed certificates trigger browser security warnings.
#       For production deployments, obtain certificates from a trusted
#       Certificate Authority (e.g. Let's Encrypt).
# =============================================================================

set -e

# shellcheck source=../commons.sh
source "$(dirname "${BASH_SOURCE[0]}")/../commons.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_FILE="$SCRIPT_DIR/key.pem"
CERT_FILE="$SCRIPT_DIR/cert.pem"

echo -e "${CYAN}==> Generating SSL key and certificate in: $SCRIPT_DIR${NC}"

if [ -f "$KEY_FILE" ] && [ -f "$CERT_FILE" ]; then
  echo -e "${GREEN}==> SSL files already exist:${NC}"
  echo -e "${WHITE}    key.pem  : $KEY_FILE${NC}"
  echo -e "${WHITE}    cert.pem : $CERT_FILE${NC}"
  echo -e "${WHITE}    Delete them and re-run this script to regenerate.${NC}"
  exit 0
fi

if ! command -v openssl &> /dev/null; then
  echo -e "${RED}ERROR: openssl is not installed or not in PATH.${NC}"
  echo -e "${RED}       Install openssl and re-run this script.${NC}"
  exit 1
fi

openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"

chmod 600 "$KEY_FILE"

echo -e "${GREEN}==> SSL files generated successfully:${NC}"
echo -e "${WHITE}    key.pem  : $KEY_FILE${NC}"
echo -e "${WHITE}    cert.pem : $CERT_FILE${NC}"
echo ""
echo -e "${WHITE}    These are self-signed certificates for development use only.${NC}"
echo -e "${WHITE}    Do NOT use them in production.${NC}"