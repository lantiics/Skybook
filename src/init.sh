#!/bin/bash
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'
if [[ ! -d "./src" ]]; then
echo -e "${RED}${BOLD}[KAIJU][ERROR] Can't find ./src directory; Ensure you're running from Kaiju's root directory.${NC}"
exit 1
fi

echo -e "${CYAN}${BOLD}[KAIJU] If Kaiju is utilizing a locally hosted captcha service, ensure it is configured in ./config.toml.${NC}\n"

echo -e "${CYAN}[KAIJU] Initializing IP source database to provide functionality to block specific anonymizing IP addresses.${NC}"
pm2 --interpreter ~/.bun/bin/bun start ./src/jobs/update-ip-lists.ts --name "Kaiju-IPMaskingDatabase" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[KAIJU] Initialized with PM2; Process name: Kaiju-IPMaskingDatabase${NC}"  

echo -e "${CYAN}[KAIJU] Initializing Kaiju...${NC}"
pm2 --interpreter ~/.bun/bin/bun start ./src/app.js --name "Kaiju" 2>&1 >/dev/null
echo -e "${GREEN}${BOLD}[KAIJU] Kaiju initialized with PM2; Process name: Kaiju${NC}"

echo -e "${CYAN}${BOLD}[KAIJU] This script does not detect errors which occur post-initialization.${NC}"