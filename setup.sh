#!/bin/bash
set -euo pipefail

rand() {
    openssl rand -hex "$1";
}

if [ ! -e .env ]; then
    PG_PASS=$(rand 16);
    READ_PASS=$(rand 16);
    WRITE_PASS=$(rand 16);
    
    cat <<EOF > .env.postgres
POSTGRES_USER=skybook
POSTGRES_PASSWORD=$PG_PASS
EOF
    cat <<EOF > .env
# replace postgres:5432 with localhost:5432 if not dockerized
SUPERUSER_DB_URL="postgres://skybook:$PG_PASS@postgres:5432/skybook" 
READ_DB_URL="postgres://skybook_reader:$READ_PASS@postgres:5432/skybook"
WRITE_DB_URL="postgres://skybook_writer:$WRITE_PASS@postgres:5432/skybook"
COOKIE_SIGNING_SECRET=$(rand 32)
IP_HASH_SECRET=$(rand 32)
NOTIFICATION_URL_KEY=$(rand 32)
CAPTCHA_SECRET=""
PORT=3000
EOF

    curl -f https://gitlab.com/lantics/skybook/-/raw/master/config.sample.toml > config.toml
    chmod 600 .env.postgres .env
    
    
    
    
    

    echo "environment variables have been generated for Skybook"

else
echo ".env file already exists; skipping generation of files"
fi


echo "some manual configuration is required for non-key features"