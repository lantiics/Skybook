#!/bin/bash
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'
if [[ ! -d "./src" ]]; then
echo -e "${RED}${BOLD}[SKYBOOK][ERROR] Can't find ./src directory; Ensure you're running from Skybook's root directory.${NC}"
exit 1
fi

echo -e "${CYAN}${BOLD}[SKYBOOK] If Skybook is utilizing a locally hosted captcha service, ensure it is configured in ./config.toml.${NC}\n"

echo -e "${CYAN}${BOLD}[SKYBOOK] Initializing jobs...${NC}\n"

# IP Sources
echo -e "${CYAN}[SKYBOOK] Initializing IP source database to provide functionality to block specific anonymizing IP addresses...${NC}"
pm2 --interpreter ~/.bun/bin/bun start ./src/jobs/update-ip-lists.ts --name "Skybook-IPMaskingDatabase" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[SKYBOOK] Initialized with PM2; Process name: Skybook-IPMaskingDatabase${NC}"  

# Account expiration
echo -e "${CYAN}[SKYBOOK] Initializing automated account expiration job...${NC}"
pm2 --interpreter ~/.bun/bin/bun start ./src/jobs/expire-accounts.ts --name "Skybook-AccountExpiration" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[SKYBOOK] Initialized with PM2; Process name: Skybook-AccountExpiration${NC}"  

# Scheduled account deletion
echo -e "${CYAN}[SKYBOOK] Initializing scheduled account deletion job...${NC}"
pm2 --interpreter ~/.bun/bin/bun start ./src/jobs/scheduled-account-deletion.ts --name "Skybook-ScheduledAccountDeletion" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[SKYBOOK] Initialized with PM2; Process name: Skybook-ScheduledAccountDeletion${NC}"  

# Enforcement lifting
echo -e "${CYAN}[SKYBOOK] Initializing enforcement lifting job...${NC}"
pm2 --interpreter ~/.bun/bin/bun start ./src/jobs/lift-enforcements.ts --name "Skybook-Enforcements" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[SKYBOOK] Initialized with PM2; Process name: Skybook-Enforcements${NC}" 

echo

# Skybook
echo -e "${CYAN}[SKYBOOK] Initializing Skybook...${NC}"
pm2 --interpreter ~/.bun/bin/bun -i max start ./src/app.js --name "Skybook" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[SKYBOOK] Skybook initialized with PM2; Process name: Skybook${NC}"

echo -e "${CYAN}${BOLD}[SKYBOOK] This script does not detect errors which occur post-initialization.${NC}"