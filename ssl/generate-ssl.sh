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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_FILE="$SCRIPT_DIR/key.pem"
CERT_FILE="$SCRIPT_DIR/cert.pem"

echo "==> Generating SSL key and certificate in: $SCRIPT_DIR"

if [ -f "$KEY_FILE" ] && [ -f "$CERT_FILE" ]; then
  echo "==> SSL files already exist:"
  echo "    key.pem  : $KEY_FILE"
  echo "    cert.pem : $CERT_FILE"
  echo "    Delete them and re-run this script to regenerate."
  exit 0
fi

if ! command -v openssl &> /dev/null; then
  echo "ERROR: openssl is not installed or not in PATH."
  echo "       Install openssl and re-run this script."
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

echo "==> SSL files generated successfully:"
echo "    key.pem  : $KEY_FILE"
echo "    cert.pem : $CERT_FILE"
echo ""
echo "    These are self-signed certificates for development use only."
echo "    Do NOT use them in production."
