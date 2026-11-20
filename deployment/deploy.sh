#!/bin/bash
cd "$(dirname "$0")" || exit 1
source ../commons.sh

# ***** Deploy script for Windfire UI React component *****

# ===== DEFAULT VALUES =====
FULL_DEPLOY=false
# Deployment profiles (URLs bundled into the build) are defined in raspberry/conf/config.yaml
DEPLOYMENT_PROFILE=
DEFAULT_DEPLOYMENT_PROFILE=lan
CONFIG_FILE=raspberry/conf/config.yaml

# ===== MAIN FUNCTION =====
main() {
    # Display header
    echo -e "${BOLD}${BLU}#######################################################################${NC}"
    echo -e "${BOLD}${BLU}############### Windfire UI React deploy procedure ####################${NC}"
    echo -e "${BOLD}${BLU}#######################################################################${NC}"
    echo

    # Parse arguments
    parseArgs "$@"

    # Start deployment
    deploy
}

parseArgs()
{
    echo -e "${BOLD}Parsing arguments...${NC}"
    PLATFORM_OPTION=
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                printHelp
                exit 0
                ;;
            -f|--full)
                FULL_DEPLOY=true
                shift
                ;;
            -p|--profile)
                if [[ -z "$2" || "$2" == -* ]]; then
                    echo -e "${RED}Error: $1 needs a profile name (lan or public)${NC}"
                    exit 1
                fi
                DEPLOYMENT_PROFILE=$2
                shift 2
                ;;
            -*)
                echo -e "${RED}Error: Unknown option '$1'${NC}"
                echo "Use --help for usage information"
                exit 1
                ;;
            *)
                PLATFORM_OPTION=$1
                shift
                ;;
        esac
    done
    selectDeploymentPlatform
    echo -e "${BOLD}Selected platform: ${DEPLOY_PLATFORM}${NC}"
}

deploy()
{
    setFunction
    $DEPLOY_FUNCTION
}

setFunction()
{
    while true; do
        case $DEPLOY_PLATFORM in
            raspberry) DEPLOY_FUNCTION="deployToRaspberry"
                return
                ;;
            *)  echo -e "${RED}No valid option selected${NC}"
                PLATFORM_OPTION=""
                PLATFORM_SELECTED=false
                selectDeploymentPlatform || exit 1
                ;;
        esac
    done
}

deployToRaspberry()
{
    ## Deploy Windfire UI React component to remote Raspberry box
    echo -e "${BLU}Deploy Windfire UI React component to Raspberry Pi ...${NC}"
    echo
    checkPrerequisites
    collectCertificateNames
    checkSSLCertificates
    selectDeploymentProfile
    collectAppConfig
    buildApp
    if [ "$FULL_DEPLOY" == true ]; then
        runPlaybook raspberry/windfire-ui-react-full-deploy.yaml
    else
        runPlaybook raspberry/windfire-ui-react-deploy.yaml
    fi
}

# ===== PRE-FLIGHT FUNCTIONS =====
printBanner()
{
    local title="***** $1 *****"
    local line
    line=$(printf '%*s' "${#title}" '' | tr ' ' '*')
    echo -e "${BLU}${line}${NC}"
    echo -e "${BLU}${title}${NC}"
    echo -e "${BLU}${line}${NC}"
}

checkPrerequisites()
{
    printBanner "Check deployment prerequisites"
    if ! command -v ansible-playbook >/dev/null 2>&1; then
        echo -e "${RED}Error: ansible-playbook not found on PATH. Install Ansible first (e.g. brew install ansible)${NC}"
        exit 1
    fi
    echo -e "${GREEN}ansible-playbook found: $(command -v ansible-playbook)${NC}"
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}Error: npm not found on PATH. Install Node.js first (e.g. brew install node)${NC}"
        exit 1
    fi
    echo -e "${GREEN}npm found: $(command -v npm)${NC}"
    if [ ! -f "$ANSIBLE_SSH_KEY" ]; then
        echo -e "${RED}Error: Ansible SSH key $ANSIBLE_SSH_KEY not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}Ansible SSH key found: $ANSIBLE_SSH_KEY${NC}"
    echo
}

checkSSLCertificates()
{
    printBanner "Check SSL certificates for Raspberry"
    if [ ! -f "$WINDFIRE_DEFAULT_CERTS_PROD_DIR/$WINDFIRE_SERVER_CERTIFICATE" ] || [ ! -f "$WINDFIRE_DEFAULT_CERTS_PROD_DIR/$WINDFIRE_SERVER_KEY" ]; then
        echo -e "${YELLOW}SSL certificate/key not found for raspberry environment. Generating...${NC}"
        echo
        ../ssl/generate-ssl-cert.sh -e raspberry -c "$WINDFIRE_SERVER_CERTIFICATE" -k "$WINDFIRE_SERVER_KEY"
        if [ ! -f "$WINDFIRE_DEFAULT_CERTS_PROD_DIR/$WINDFIRE_SERVER_CERTIFICATE" ] || [ ! -f "$WINDFIRE_DEFAULT_CERTS_PROD_DIR/$WINDFIRE_SERVER_KEY" ]; then
            echo -e "${RED}Error: SSL certificate/key still missing in $WINDFIRE_DEFAULT_CERTS_PROD_DIR${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}SSL certificate and key found in $WINDFIRE_DEFAULT_CERTS_PROD_DIR${NC}"
    echo
}

# ===== APPLICATION CONFIGURATION FUNCTIONS =====
# Print deployment_profiles[<profile>][<key>] from $CONFIG_FILE, rendered by Ansible (values may be templated)
getProfileValue()
{
    local profile=$1
    local key=$2
    ANSIBLE_LOCALHOST_WARNING=false ANSIBLE_LOAD_CALLBACK_PLUGINS=true ANSIBLE_STDOUT_CALLBACK=json \
        ansible localhost -i localhost, -c local -m ansible.builtin.debug \
        -a "msg={{ deployment_profiles[profile][key] }}" \
        -e "@$CONFIG_FILE" -e "profile=$profile" -e "key=$key" 2>/dev/null \
    | python3 -c '
import json, sys
try:
    result = json.load(sys.stdin)["plays"][0]["tasks"][0]["hosts"]["localhost"]
except (ValueError, LookupError):
    sys.exit(1)
if result.get("failed") or not isinstance(result.get("msg"), str) or not result["msg"]:
    sys.exit(1)
print(result["msg"])'
}

selectDeploymentProfile()
{
    printBanner "Select deployment profile"
    if [[ -z "$DEPLOYMENT_PROFILE" ]]; then
        DEPLOYMENT_PROFILE=$(inputWithDefault "deployment profile, lan or public (see $CONFIG_FILE)" "$DEFAULT_DEPLOYMENT_PROFILE")
    fi
    PROFILE_KEYCLOAK_URL=$(getProfileValue "$DEPLOYMENT_PROFILE" vite_keycloak_url)
    PROFILE_RESTAURANTS_URL=$(getProfileValue "$DEPLOYMENT_PROFILE" vite_restaurants_url)
    if [[ -z "$PROFILE_KEYCLOAK_URL" || -z "$PROFILE_RESTAURANTS_URL" ]]; then
        echo -e "${RED}Error: profile '$DEPLOYMENT_PROFILE' not found in deployment_profiles of deployment/$CONFIG_FILE (or a URL is missing)${NC}"
        exit 1
    fi
    export DEPLOYMENT_PROFILE
    echo -e "${GREEN}Profile $DEPLOYMENT_PROFILE: Keycloak $PROFILE_KEYCLOAK_URL, Restaurants API $PROFILE_RESTAURANTS_URL${NC}"
    echo
}

# Same rule as server.js: an absolute http(s) URL or a same-origin path (/restaurants), never //host
isValidRestaurantsUrl()
{
    local value=$1
    [[ "$value" =~ ^https?://[^/]+ ]] || [[ "$value" == /* && "$value" != //* ]]
}

inputWithDefault()
{
    local label=$1
    local default=$2
    local value=
    while [[ -z "$value" ]]; do
        read -r -p "${CYAN_P}Input $label [${default}]: ${END}" value
        value=${value:-$default}
        if [[ -z "$value" ]]; then
            echo -e "${RED}$label cannot be blank${NC}" >&2
        fi
    done
    echo "$value"
}

collectCertificateNames()
{
    printBanner "Collect SSL certificate filenames"
    WINDFIRE_SERVER_CERTIFICATE=$(inputWithDefault "server certificate filename" "$WINDFIRE_SERVER_CERTIFICATE")
    WINDFIRE_SERVER_KEY=$(inputWithDefault "server private key filename" "$WINDFIRE_SERVER_KEY")
    validateCertFileNames "$WINDFIRE_SERVER_CERTIFICATE" "$WINDFIRE_SERVER_KEY" || exit 1
    # Read by conf/config.yaml, so the playbook deploys the same files
    export WINDFIRE_SERVER_CERTIFICATE WINDFIRE_SERVER_KEY
    echo
}

warnIfLocalhost()
{
    local name=$1
    local value=$2
    if [[ "$value" == *localhost* || "$value" == *127.0.0.1* ]]; then
        echo -e "${YELLOW}Warning: $name=$value points at localhost: browsers using the Raspberry deployment will not reach it${NC}"
    fi
}

collectAppConfig()
{
    printBanner "Collect application configuration"
    echo -e "${WHITE}These values are bundled into the React build and are public: do not use secrets here${NC}"
    local envFile=../.env
    VITE_KEYCLOAK_URL=$(inputWithDefault "Keycloak URL (VITE_KEYCLOAK_URL)" "$PROFILE_KEYCLOAK_URL")
    # server.js refuses to start with a relative Keycloak URL (left over from the removed /keycloak proxy)
    while [[ "$VITE_KEYCLOAK_URL" == /* ]]; do
        echo -e "${RED}VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL is relative: the /keycloak proxy has been removed. Enter the absolute https:// URL of Keycloak (and fix it in .env)${NC}"
        VITE_KEYCLOAK_URL=$(inputWithDefault "Keycloak URL (VITE_KEYCLOAK_URL)" "")
    done
    VITE_KEYCLOAK_REALM=$(inputWithDefault "Keycloak realm (VITE_KEYCLOAK_REALM)" "$(getEnvFileValue $envFile VITE_KEYCLOAK_REALM)")
    VITE_KEYCLOAK_CLIENT_ID=$(inputWithDefault "Keycloak client id (VITE_KEYCLOAK_CLIENT_ID)" "$(getEnvFileValue $envFile VITE_KEYCLOAK_CLIENT_ID)")
    VITE_RESTAURANTS_URL=$(inputWithDefault "Restaurants API URL (VITE_RESTAURANTS_URL)" "$PROFILE_RESTAURANTS_URL")
    # server.js refuses anything else (a //host value would point to another origin)
    while ! isValidRestaurantsUrl "$VITE_RESTAURANTS_URL"; do
        echo -e "${RED}VITE_RESTAURANTS_URL=$VITE_RESTAURANTS_URL must be an absolute https:// URL or a same-origin path such as /restaurants${NC}"
        VITE_RESTAURANTS_URL=$(inputWithDefault "Restaurants API URL (VITE_RESTAURANTS_URL)" "$PROFILE_RESTAURANTS_URL")
    done
    warnIfLocalhost VITE_KEYCLOAK_URL "$VITE_KEYCLOAK_URL"
    warnIfLocalhost VITE_RESTAURANTS_URL "$VITE_RESTAURANTS_URL"
    export VITE_KEYCLOAK_URL VITE_KEYCLOAK_REALM VITE_KEYCLOAK_CLIENT_ID VITE_RESTAURANTS_URL
    echo
}

# ===== BUILD FUNCTIONS =====
buildApp()
{
    printBanner "Build React application"
    # Exported VITE_* variables take precedence over the values in the local .env
    if ! (cd .. && npm ci && npm run build); then
        echo -e "${RED}Error: React build failed: see npm output above${NC}"
        exit 1
    fi
    if [ ! -f ../dist/index.html ]; then
        echo -e "${RED}Error: dist/index.html not found after the build${NC}"
        exit 1
    fi
    echo -e "${GREEN}React application built in $WINDFIRE_UI_REACT_HOME/dist${NC}"
    echo
}

# ===== ANSIBLE FUNCTIONS =====
runPlaybook()
{
    local playbook=$1
    printBanner "Run Ansible playbook $playbook"
    eval "$(ssh-agent -s)" >/dev/null
    trap 'ssh-agent -k >/dev/null' EXIT
    ssh-add "$ANSIBLE_SSH_KEY" || { echo -e "${RED}Error: ssh-add $ANSIBLE_SSH_KEY failed${NC}"; exit 1; }
    export ANSIBLE_CONFIG=$PWD/raspberry/ansible.cfg
    echo -e "${YELLOW}Ansible will ask for the BECOME password: the sudo password of user pi on the Raspberry${NC}"
    if ansible-playbook "$playbook"; then
        echo -e "${GREEN}Windfire UI React deployed and running on Raspberry Pi${NC}"
        echo
    else
        echo -e "${RED}Deployment failed: see Ansible output above${NC}"
        exit 1
    fi
}

# ===== HELP FUNCTION =====
printHelp() {
    echo -e "${BOLD}╔═════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║    Windfire UI React - Deploy Script                    ║${NC}"
    echo -e "${BOLD}╚═════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BOLD}DESCRIPTION:${NC}"
    echo -e "Builds the Windfire UI React application locally, deploys it to the frontend"
    echo -e "Ansible host group and runs it as the windfire-ui-react systemd service (HTTPS, port 8445),"
    echo -e "under the windfire-ui system user."
    echo
    echo -e "${BOLD}USAGE:${NC}"
    echo -e "    ./deploy.sh [1] [-f] [-p lan|public]"
    echo
    echo -e "${BOLD}ARGUMENTS:${NC}"
    echo -e "1                       Deployment platform: 1=Raspberry (prompted if omitted)"
    echo
    echo -e "${BOLD}OPTIONS:${NC}"
    echo -e "-f, --full              Full deploy: upgrade system packages and install Node.js first"
    echo -e "                        (needed on the first deploy to a Raspberry without Node.js)"
    echo -e "-p, --profile NAME      Deployment profile from raspberry/conf/config.yaml (prompted if omitted, default lan):"
    echo -e "                        lan    = Keycloak https://raspberry01:8443, API https://raspberry02:8081/restaurants"
    echo -e "                        public = Keycloak https://auth.<public_domain>, API /restaurants on the UI's own origin"
    echo -e "                                 (both reached through the Cloudflare Tunnel)"
    echo -e "-h, --help              Display this help message and exit"
    echo
    echo -e "${BOLD}WHAT THIS SCRIPT DOES:${NC}"
    echo -e "1. Check that ansible-playbook, npm and the Ansible SSH key are available"
    echo -e "2. Ask for the server certificate and key filenames (defaults: $WINDFIRE_SERVER_CERTIFICATE, $WINDFIRE_SERVER_KEY)"
    echo -e "3. Check the production server certificate and key (generated if missing)"
    echo -e "4. Ask for the deployment profile, then the Keycloak and Restaurants API settings"
    echo -e "   (URL defaults from the profile, realm and client id defaults from .env)"
    echo -e "5. Build the React application with those settings (npm ci && npm run build)"
    echo -e "6. Run the Ansible playbook (asks for the sudo password of user pi on the Raspberry):"
    echo -e "   check the shared Windfire Root CA in /etc/windfire/ca (installed by windfire-raspberry's configure-windfire-infra.sh --tags windfire_ca),"
    echo -e "   deploy, start the systemd service and health-check it"
    echo
    echo -e "${BOLD}EXIT CODES:${NC}"
    echo -e "   0   Success"
    echo -e "   1   Invalid arguments, failed pre-flight check, failed build or failed deployment"
}

# ===== EXECUTION =====
main "$@"
