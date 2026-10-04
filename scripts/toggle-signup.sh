#!/bin/bash
source ./inject-env.sh

value=$(psql -tA "$WRITE_DB_URL" << 'EOF'
WITH flip AS (
  UPDATE service_settings
  SET value = NOT value
  WHERE name = 'signup_enabled'
  RETURNING value
)
SELECT value FROM flip;
EOF
)

if [ "$value" = "f" ]; then
echo "Skybook signup is now disabled"
elif [ "$value" = "t" ]; then
echo "Skybook signup is now enabled"
fi