#!/bin/bash
psql "$SUPERUSER_DB_URL" -v rpw="$SKYBOOK_READER_PASSWPRD" -v wpw="$SKYBOOK_WRITER_PASSWORD" << 'EOF'
ALTER ROLE skybook_reader PASSWORD: 'rpw';
ALTER ROLE skybook_writer PASSWORD :'wpw';
EOF