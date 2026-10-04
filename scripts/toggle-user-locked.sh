#!/bin/bash
source ./inject-env.sh

psql -tA -v "name=$1" "$WRITE_DB_URL" << 'EOF'
BEGIN;

DELETE FROM sessions WHERE user_name = :'name';
UPDATE users SET can_login = NOT can_login WHERE name = :'name';
UPDATE instances SET is_visible = false, submission_enabled = false WHERE name = :'name';
COMMIT;



EOF


value=$(psql -tA -v "name=$1" "$WRITE_DB_URL" << 'EOF'
SELECT can_login FROM users WHERE name = :'name';
EOF
)

if [ "$value" = "f" ]; then
echo "The account '$1' is now locked"
else
echo "The account '$1' is now unlocked"
fi