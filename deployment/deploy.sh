#!/bin/bash
cd "$(dirname "$0")" || exit 1
source ../commons.sh

# ***** Deploy script for Windfire UI React component *****

# ===== DEFAULT VALUES =====
FULL_DEPLOY=false

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
    checkRootCA
    checkSSLCertificates
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

checkRootCA()
{
    printBanner "Check Windfire Root CA"
    if [ ! -f "$WINDFIRE_DEFAULT_TRUSTSTORE_DIR/$WINDFIRE_ROOT_CA_CERTIFICATE" ]; then
        echo -e "${RED}Error: Windfire Root CA $WINDFIRE_DEFAULT_TRUSTSTORE_DIR/$WINDFIRE_ROOT_CA_CERTIFICATE not found${NC}"
        echo -e "${RED}Create it with windfire-security/ssl/createRootCA.sh first${NC}"
        exit 1
    fi
    echo -e "${GREEN}Windfire Root CA found in $WINDFIRE_DEFAULT_TRUSTSTORE_DIR${NC}"
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

# Like inputWithDefault, but a blank answer is accepted; "-" clears a non-empty default
inputOptional()
{
    local label=$1
    local default=$2
    local value=
    read -r -p "${CYAN_P}Input $label (optional, - for none) [${default}]: ${END}" value
    value=${value:-$default}
    if [[ "$value" == "-" ]]; then
        value=
    fi
    echo "$value"
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
    REACT_APP_KEYCLOAK_URL=$(inputWithDefault "Keycloak URL (REACT_APP_KEYCLOAK_URL)" "$(getEnvFileValue $envFile REACT_APP_KEYCLOAK_URL)")
    REACT_APP_KEYCLOAK_REALM=$(inputWithDefault "Keycloak realm (REACT_APP_KEYCLOAK_REALM)" "$(getEnvFileValue $envFile REACT_APP_KEYCLOAK_REALM)")
    REACT_APP_KEYCLOAK_CLIENT_ID=$(inputWithDefault "Keycloak client id (REACT_APP_KEYCLOAK_CLIENT_ID)" "$(getEnvFileValue $envFile REACT_APP_KEYCLOAK_CLIENT_ID)")
    REACT_APP_RESTAURANTS_URL=$(inputWithDefault "Restaurants API URL (REACT_APP_RESTAURANTS_URL)" "$(getEnvFileValue $envFile REACT_APP_RESTAURANTS_URL)")
    KEYCLOAK_PROXY_TARGET=$(inputOptional "Keycloak proxy target (KEYCLOAK_PROXY_TARGET)" "$(getEnvFileValue $envFile KEYCLOAK_PROXY_TARGET)")
    warnIfLocalhost REACT_APP_KEYCLOAK_URL "$REACT_APP_KEYCLOAK_URL"
    warnIfLocalhost REACT_APP_RESTAURANTS_URL "$REACT_APP_RESTAURANTS_URL"
    warnIfLocalhost KEYCLOAK_PROXY_TARGET "$KEYCLOAK_PROXY_TARGET"
    export REACT_APP_KEYCLOAK_URL REACT_APP_KEYCLOAK_REALM REACT_APP_KEYCLOAK_CLIENT_ID REACT_APP_RESTAURANTS_URL KEYCLOAK_PROXY_TARGET
    echo
}

# ===== BUILD FUNCTIONS =====
buildApp()
{
    printBanner "Build React application"
    # Exported REACT_APP_* variables take precedence over the values in the local .env
    if ! (cd .. && npm ci && npm run build); then
        echo -e "${RED}Error: React build failed: see npm output above${NC}"
        exit 1
    fi
    if [ ! -f ../build/index.html ]; then
        echo -e "${RED}Error: build/index.html not found after the build${NC}"
        exit 1
    fi
    echo -e "${GREEN}React application built in $WINDFIRE_UI_REACT_HOME/build${NC}"
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
    echo -e "Ansible host group and runs it as the windfire-ui-react systemd service (HTTPS, port 9443)."
    echo
    echo -e "${BOLD}USAGE:${NC}"
    echo -e "    ./deploy.sh [1] [-f]"
    echo
    echo -e "${BOLD}ARGUMENTS:${NC}"
    echo -e "1                       Deployment platform: 1=Raspberry (prompted if omitted)"
    echo
    echo -e "${BOLD}OPTIONS:${NC}"
    echo -e "-f, --full              Full deploy: upgrade system packages and install Node.js first"
    echo -e "                        (needed on the first deploy to a Raspberry without Node.js)"
    echo -e "-h, --help              Display this help message and exit"
    echo
    echo -e "${BOLD}WHAT THIS SCRIPT DOES:${NC}"
    echo -e "1. Check that ansible-playbook, npm and the Ansible SSH key are available"
    echo -e "2. Check that the Windfire Root CA exists"
    echo -e "3. Check the production server certificate and key (generated if missing)"
    echo -e "4. Ask for the Keycloak and Restaurants API settings (defaults from .env)"
    echo -e "5. Build the React application with those settings (npm ci && npm run build)"
    echo -e "6. Run the Ansible playbook (asks for the sudo password of user pi on the Raspberry):"
    echo -e "   deploy, start the systemd service and health-check it"
    echo
    echo -e "${BOLD}EXIT CODES:${NC}"
    echo -e "   0   Success"
    echo -e "   1   Invalid arguments, failed pre-flight check, failed build or failed deployment"
}

# ===== EXECUTION =====
main "$@"
