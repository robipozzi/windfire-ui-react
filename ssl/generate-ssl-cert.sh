#!/bin/bash

# =============================================================================
# generate-ssl-cert.sh
#
# Issues a TLS private key + leaf certificate signed by the Windfire Root CA
# (see windfire-security/ssl/createRootCA.sh), for use by this app's HTTPS
# server. Selectable by environment (localhost / raspberry), with
# configurable output filenames.
#
# Output files:
#   localhost   — written to the same directory as this script
#   raspberry   — written to $HOME/opt/windfire/ssl/certs/raspberry
#                 (never touches files under this script's directory)
#
#   windfire-key.pem  — RSA 4096-bit private key
#   windfire-cert.pem — X.509 certificate signed by the Windfire Root CA
#                        (valid 365 days)
#
# NOTE: The Windfire Root CA is not in the system/browser trust store by
#       default — it must be trusted separately by any client connecting
#       to this server (see README.md).
# =============================================================================

set -e

# shellcheck source=../commons.sh
source "$(dirname "${BASH_SOURCE[0]}")/../commons.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ===== DEFAULT VALUES =====
ENVIRONMENT="localhost"
ENV_EXPLICIT=false
CERT_NAME="windfire-cert.pem"
KEY_NAME="windfire-key.pem"
CA_NAME="WindfireRootCA.crt"

ROOT_CA_TRUSTSTORE_DIR="$HOME/opt/windfire/ssl/truststore"
ROOT_CA_KEYSTORE_DIR="$HOME/opt/windfire/ssl/keystore"

# ===== ARGUMENT PARSING FUNCTION =====
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                ENVIRONMENT="$2"
                ENV_EXPLICIT=true
                shift 2
                ;;
            -c|--cert-name)
                CERT_NAME="$2"
                shift 2
                ;;
            -k|--key-name)
                KEY_NAME="$2"
                shift 2
                ;;
            -a|--ca-name)
                CA_NAME="$2"
                shift 2
                ;;
            -h|--help)
                print_help
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${NC}"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# ===== HELP FUNCTION =====
print_help() {
    echo -e "${BOLD}=================================================${NC}"
    echo -e "${BOLD}Windfire UI - SSL Certificate Generation${NC}"
    echo -e "${BOLD}=================================================${NC}"
    echo
    echo -e "${BOLD}DESCRIPTION:${NC}"
    echo -e "    Generates a TLS private key and leaf certificate signed by the"
    echo -e "    Windfire Root CA, for use by this app's HTTPS server."
    echo
    echo -e "${BOLD}USAGE:${NC}"
    echo -e "    ./generate-ssl-cert.sh [OPTIONS]"
    echo
    echo -e "${BOLD}OPTIONS:${NC}"
    echo -e "    -e, --env <localhost|raspberry>   Target environment"
    echo -e "                                       Default: localhost"
    echo -e "                                       If omitted in an interactive terminal,"
    echo -e "                                       you'll be prompted to choose."
    echo
    echo -e "    -c, --cert-name <file>            Output certificate filename"
    echo -e "                                       Default: windfire-cert.pem"
    echo
    echo -e "    -k, --key-name <file>             Output private key filename"
    echo -e "                                       Default: windfire-key.pem"
    echo
    echo -e "    -a, --ca-name <file>              Windfire Root CA certificate filename"
    echo -e "                                       (looked up in the truststore)"
    echo -e "                                       Default: WindfireRootCA.crt"
    echo
    echo -e "    -h, --help                        Display this help message and exit"
    echo
    echo -e "${BOLD}EXAMPLES:${NC}"
    echo -e "    # Generate a localhost cert with default filenames"
    echo -e "    ./generate-ssl-cert.sh"
    echo
    echo -e "    # Generate a raspberry02 cert with custom filenames"
    echo -e "    ./generate-ssl-cert.sh -e raspberry -c raspberry-cert.pem -k raspberry-key.pem"
    echo
    echo -e "${BOLD}PREREQUISITES:${NC}"
    echo -e "    The Windfire Root CA must already exist (run"
    echo -e "    windfire-security/ssl/createRootCA.sh first)."
    echo -e "${BOLD}=================================================${NC}"
}

# ===== ENVIRONMENT PROMPT FUNCTION =====
prompt_environment() {
    echo -e "${CYAN}Select environment:${NC}"
    echo -e "${WHITE}  1) localhost${NC}"
    echo -e "${WHITE}  2) raspberry${NC}"
    while true; do
        read -r -p "Enter choice [1]: " CHOICE
        case "$CHOICE" in
            ""|1)
                ENVIRONMENT="localhost"
                break
                ;;
            2)
                ENVIRONMENT="raspberry"
                break
                ;;
            *)
                echo -e "${RED}Invalid choice '$CHOICE' — enter 1 or 2.${NC}"
                ;;
        esac
    done
}

# ===== ENVIRONMENT RESOLUTION FUNCTION =====
resolve_environment() {
    case "$ENVIRONMENT" in
        localhost)
            COMMON_NAME="localhost"
            EXT_FILE="$SCRIPT_DIR/openssl_config_localhost.ext"
            OUTPUT_DIR="$SCRIPT_DIR"
            ;;
        raspberry)
            COMMON_NAME="raspberry02"
            EXT_FILE="$SCRIPT_DIR/openssl_config_raspberry.ext"
            OUTPUT_DIR="$HOME/opt/windfire/ssl/certs/raspberry"
            ;;
        *)
            echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
            echo "Valid options: localhost, raspberry"
            exit 1
            ;;
    esac
}

# ===== PREFLIGHT CHECKS FUNCTION =====
preflight_checks() {
    if ! command -v openssl &> /dev/null; then
        echo -e "${RED}ERROR: openssl is not installed or not in PATH.${NC}"
        echo -e "${RED}       Install openssl and re-run this script.${NC}"
        exit 1
    fi

    mkdir -p "$OUTPUT_DIR"

    if [ -f "$CERT_FILE" ] || [ -f "$KEY_FILE" ]; then
        echo -e "${YELLOW}==> Existing SSL files found — deleting and regenerating:${NC}"
        echo -e "${WHITE}    $KEY_NAME : $KEY_FILE${NC}"
        echo -e "${WHITE}    $CERT_NAME : $CERT_FILE${NC}"
        rm -f "$CERT_FILE" "$KEY_FILE"
    fi

    if [ ! -f "$ROOT_CA_CERT_PATH" ] || [ ! -f "$ROOT_CA_KEY_PATH" ]; then
        echo -e "${RED}Error: Windfire Root CA not found (expected $ROOT_CA_CERT_PATH and $ROOT_CA_KEY_PATH).${NC}"
        echo -e "${RED}Run windfire-security/ssl/createRootCA.sh first.${NC}"
        exit 1
    fi

    if [ ! -f "$EXT_FILE" ]; then
        echo -e "${RED}Error: SAN config file not found: $EXT_FILE${NC}"
        exit 1
    fi
}

# ===== CERTIFICATE GENERATION FUNCTION =====
generate_certificate() {
    CSR_FILE="$(mktemp)"
    trap 'rm -f "$CSR_FILE"' EXIT

    echo -e "${CYAN}==> Generating SSL key and certificate in: $OUTPUT_DIR${NC}"

    if ! openssl genrsa -out "$KEY_FILE" 4096; then
        echo -e "${RED}Error: failed to generate private key${NC}"
        rm -f "$CERT_FILE" "$KEY_FILE"
        exit 1
    fi

    if ! openssl req -new -key "$KEY_FILE" -out "$CSR_FILE" \
            -subj "/C=IT/ST=Lombardia/L=Milano/O=Windfire/OU=Windfire UI/CN=$COMMON_NAME"; then
        echo -e "${RED}Error: failed to create certificate signing request${NC}"
        rm -f "$CERT_FILE" "$KEY_FILE"
        exit 1
    fi

    echo -e "${WHITE}    Signing with Windfire Root CA (you may be prompted for its passphrase) ...${NC}"
    if ! openssl x509 -req -in "$CSR_FILE" -CA "$ROOT_CA_CERT_PATH" -CAkey "$ROOT_CA_KEY_PATH" -CAcreateserial \
            -out "$CERT_FILE" -days 365 -sha256 -extfile "$EXT_FILE"; then
        echo -e "${RED}Error: failed to sign certificate${NC}"
        rm -f "$CERT_FILE" "$KEY_FILE"
        exit 1
    fi

    chmod 600 "$KEY_FILE"
}

# ===== MAIN FUNCTION =====
main() {
    parse_args "$@"

    if [ "$ENV_EXPLICIT" = false ] && [ -t 0 ]; then
        prompt_environment
    fi

    resolve_environment

    CERT_FILE="$OUTPUT_DIR/$CERT_NAME"
    KEY_FILE="$OUTPUT_DIR/$KEY_NAME"
    ROOT_CA_KEY_NAME="${CA_NAME%.crt}.key"
    ROOT_CA_CERT_PATH="$ROOT_CA_TRUSTSTORE_DIR/$CA_NAME"
    ROOT_CA_KEY_PATH="$ROOT_CA_KEYSTORE_DIR/$ROOT_CA_KEY_NAME"

    preflight_checks
    generate_certificate

    echo -e "${GREEN}==> SSL files generated successfully:${NC}"
    echo -e "${WHITE}    $KEY_NAME : $KEY_FILE${NC}"
    echo -e "${WHITE}    $CERT_NAME : $CERT_FILE${NC}"
    echo ""
    echo -e "${WHITE}    Environment : $ENVIRONMENT${NC}"
    echo -e "${WHITE}    CN / SAN    : $COMMON_NAME${NC}"
    echo -e "${WHITE}    Signed by   : $ROOT_CA_CERT_PATH${NC}"
    echo ""
    echo -e "${WHITE}    The Windfire Root CA is not in the system trust store by default —${NC}"
    echo -e "${WHITE}    it must be trusted separately by any client connecting over HTTPS.${NC}"
}

# ===== EXECUTION =====
main "$@"
