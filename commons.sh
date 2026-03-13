#!/bin/bash
# Shared color definitions for all shell scripts in this project.
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/commons.sh"  (from project root)
#        source "$(dirname "${BASH_SOURCE[0]}")/../commons.sh" (from subdirectories)

CYAN='\033[1;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[1;31m'
WHITE='\033[0;37m'
NC='\033[0m' # No Color