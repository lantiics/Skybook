#!/bin/bash
source ./inject-env.sh

value=$(psql -tA "$SUPERUSER_DB_URL" << 'EOF'
WITH flip AS (
  UPDATE service_settings
  SET value = NOT value
  WHERE name = 'login_enabled'
  RETURNING value
)
SELECT value FROM flip;
EOF
)

if [ "$value" = "f" ]; then
echo "Skybook login is now disabled"
elif [ "$value" = "t" ]; then
echo "Skybook login is now enabled"
fi