#!/bin/bash
source ./inject-env.sh

value=$(psql -tA "$SUPERUSER_DB_URL" << 'EOF'
WITH flip AS (
  UPDATE service_settings
  SET value = NOT value
  WHERE name = 'signup_requires_invitation'
  RETURNING value
)
SELECT value FROM flip;
EOF
)

if [ "$value" = "f" ]; then
echo "An invitation is no longer required to sign up to Skybook"
elif [ "$value" = "t" ]; then
echo "An invitation is now required to sign up to Skybook"
fi