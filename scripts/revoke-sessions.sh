#!/bin/bash
source ./inject-env.sh

value=$(psql -tA "$SUPERUSER_DB_URL" << 'EOF'
DELETE FROM sessions;
EOF
)

echo "All Skybook sessions have been revoked"