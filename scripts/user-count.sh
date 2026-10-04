#!/bin/bash
source ./inject-env.sh

value=$(psql -tA "$WRITE_DB_URL" << 'EOF'
SELECT COUNT(*) FROM users;
EOF
)

echo "Skybook currently has $value users"