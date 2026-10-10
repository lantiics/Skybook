#!/bin/bash

[ -f docker-compose.yml ] && { echo "docker-compose.yml already exists; exiting"; exit 1; }

curl https://gitlab.com/lantics/skybook/-/raw/master/docker-compose.yml -o docker-compose.yml

echo "default configuration for Skybook has been created. some manual configuration is required, but running 'docker compose up' should allow you to access Skybook at:"
echo "localhost:3000"
echo
echo "it is highly advisable to review your configuration and adjust any settings to your environment"