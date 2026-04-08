#!/bin/bash
# Shared color definitions for all shell scripts in this project.
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
# ===== EMOJI =====
coffee=$'\xE2\x98\x95'
coffee3="${coffee} ${coffee} ${coffee}"
##### TERMINAL COLORS - END