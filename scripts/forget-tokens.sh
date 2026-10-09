#!/bin/bash
source ./inject-env.sh

value=$(psql -tA "$SUPERUSER_DB_URL" << 'EOF'
DELETE FROM tokens;
EOF
)

echo "All tokens associated with Skybook posts have been forgotten"