for file in ../../migrations/*.sql; do
    if [ -f "$file" ]; then
        cat "$file" | psql "$SUPERUSER_DB_URL" -f-
    fi
done