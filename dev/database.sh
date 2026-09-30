#!/bin/bash

POSTGRES_DB="skybook"
POSTGRES_USER="skybook"
POSTGRES_PASSWORD="skybook"
READ_DB_URL="postgres://skybook:skybook@postgres:5432/skybook"
WRITE_DB_URL=$READ_DB_URL

docker compose -f ./postgres-compose.yml up --detach

cat ../migrations/000_reservations.sql | docker exec -i skybook-postgres-1 psql -h localhost -U skybook -f-
cat ../migrations/001_init.sql | docker exec -i skybook-postgres-1 psql -h localhost -U skybook -f-
cat ../migrations/002_enforcements.sql | docker exec -i skybook-postgres-1 psql -h localhost -U skybook -f-
