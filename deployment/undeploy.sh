#!/bin/bash
cd "$(dirname "$0")" || exit 1
source ../commons.sh

# ***** Undeploy script for Windfire UI React component *****

# ===== DEFAULT VALUES =====
ASSUME_YES=false

# ===== MAIN FUNCTION =====
main() {
    # Display header
    echo -e "${BOLD}${BLU}#########################################################################${NC}"
    echo -e "${BOLD}${BLU}############### Windfire UI React undeploy procedure ####################${NC}"
    echo -e "${BOLD}${BLU}#########################################################################${NC}"
    echo

    # Parse arguments
    parseArgs "$@"

    # Start undeployment
    undeploy
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
            -y|--yes)
                ASSUME_YES=true
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

undeploy()
{
    setFunction
    $DEPLOY_FUNCTION
}

setFunction()
{
    while true; do
        case $DEPLOY_PLATFORM in
            raspberry) DEPLOY_FUNCTION="undeployFromRaspberry"
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

confirmUndeploy()
{
    if [ "$ASSUME_YES" == true ]; then
        return
    fi
    local answer
    read -r -p "${YELLOW_P}This stops and removes the windfire-ui-react service and application folder. Continue? [y/N]: ${END}" answer
    case $answer in
        y|Y|yes|YES) ;;
        *)  echo -e "${CYAN}Undeploy cancelled${NC}"
            exit 0
            ;;
    esac
}

undeployFromRaspberry()
{
    ## Undeploy Windfire UI React component from remote Raspberry box
    echo -e "${BLU}Undeploy Windfire UI React component from Raspberry Pi ...${NC}"
    confirmUndeploy
    eval "$(ssh-agent -s)" >/dev/null
    trap 'ssh-agent -k >/dev/null' EXIT
    ssh-add "$ANSIBLE_SSH_KEY" || { echo -e "${RED}Error: ssh-add $ANSIBLE_SSH_KEY failed${NC}"; exit 1; }
    export ANSIBLE_CONFIG=$PWD/raspberry/ansible.cfg
    echo -e "${YELLOW}Ansible will ask for the BECOME password: the sudo password of user pi on the Raspberry${NC}"
    if ansible-playbook raspberry/windfire-ui-react-undeploy.yaml; then
        echo -e "${GREEN}Windfire UI React removed from Raspberry Pi${NC}"
        echo
    else
        echo -e "${RED}Undeployment failed: see Ansible output above${NC}"
        exit 1
    fi
}

# ===== HELP FUNCTION =====
printHelp() {
    echo -e "${BOLD}╔═════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║    Windfire UI React - Undeploy Script                  ║${NC}"
    echo -e "${BOLD}╚═════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BOLD}DESCRIPTION:${NC}"
    echo -e "Stops and removes the windfire-ui-react systemd service and the application"
    echo -e "folder from the frontend Ansible host group. Node.js and the Windfire Root CA are left in place."
    echo
    echo -e "${BOLD}USAGE:${NC}"
    echo -e "    ./undeploy.sh [1] [-y]"
    echo
    echo -e "${BOLD}ARGUMENTS:${NC}"
    echo -e "1                       Deployment platform: 1=Raspberry (prompted if omitted)"
    echo
    echo -e "${BOLD}OPTIONS:${NC}"
    echo -e "-y, --yes               Do not ask for confirmation (the sudo password of user pi is still asked)"
    echo -e "-h, --help              Display this help message and exit"
    echo
    echo -e "${BOLD}EXIT CODES:${NC}"
    echo -e "   0   Success, or cancelled by the operator"
    echo -e "   1   Invalid arguments or failed undeployment"
}

# ===== EXECUTION =====
main "$@"
