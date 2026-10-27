#!/bin/bash
# Shared color definitions, variables and functions for all shell scripts in this project.
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/commons.sh"  (from project root)
#        source "$(dirname "${BASH_SOURCE[0]}")/../commons.sh" (from subdirectories)

##### TERMINAL COLORS - START
# ===== COLOR CODES =====
CYAN='\033[1;36m'
BLU='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[1;31m'
MAGENTA='\033[1;35m'
WHITE='\033[0;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'
UNDERLINE='\033[4m'
# ANSI-C quoted variants, for strings not printed with echo -e (e.g. read -p prompts)
CYAN_P=$'\e[1;36m'
YELLOW_P=$'\e[0;33m'
END=$'\e[0m'
# ===== EMOJI =====
coffee=$'\xE2\x98\x95'
coffee3="${coffee} ${coffee} ${coffee}"
##### TERMINAL COLORS - END

###### Variable section - START
# ===== DEPLOYMENT / UNDEPLOYMENT VARIABLES =====
PLATFORM_OPTION=
PLATFORM_SELECTED=false
DEPLOY_PLATFORM=
DEPLOY_FUNCTION=
# Repository root (resolved from this file, so it works whatever the caller's working directory is)
WINDFIRE_UI_REACT_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WINDFIRE_SERVER_CERTIFICATE=windfire-ui-react.crt
WINDFIRE_SERVER_KEY=windfire-ui-react.key
ANSIBLE_SSH_KEY=$HOME/.ssh/ansible_rsa

# ===== ROOT CA VARIABLES =====
WINDFIRE_ROOT_CA_CERTIFICATE="WindfireRootCA.crt"
WINDFIRE_DEFAULT_TRUSTSTORE_DIR=$HOME/opt/windfire/ssl/truststore
WINDFIRE_DEFAULT_CERTS_PROD_DIR=$HOME/opt/windfire/ssl/certs/raspberry
###### Variable section - END

###### Function section - START
# Function to read a single KEY=value from an env file (.env can't be sourced: values with spaces, inline comments)
getEnvFileValue()
{
    local file=$1
    local key=$2
    local value
    value=$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1)
    value=${value#*=}
    value=${value%%#*}
    value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    value=${value#[\"\']}
    value=${value%[\"\']}
    echo "$value"
}

# Functions to select and set deployment platform
selectDeploymentPlatform()
{
    if [[ $PLATFORM_OPTION == "" && $PLATFORM_SELECTED == false ]]; then
        echo -e "${BLU}No platform option provided - Select deployment platform :${NC}"
        echo -e "${GREEN}1. Raspberry${NC}"
        if ! read PLATFORM_OPTION; then
            echo -e "${RED}No input available to select deployment platform${NC}"
            exit 1
        fi
        setDeploymentPlatform
    else
        echo -e "${CYAN}Platform option provided as argument: $PLATFORM_OPTION${NC}"
        setDeploymentPlatform
    fi
}

setDeploymentPlatform()
{
    case $PLATFORM_OPTION in
        1)  DEPLOY_PLATFORM="raspberry"
            PLATFORM_SELECTED=true
            ;;
        *)  echo -e "${RED}No valid option selected${NC}"
            PLATFORM_OPTION=""
            PLATFORM_SELECTED=false
            selectDeploymentPlatform
            ;;
    esac
}
###### Function section - END
