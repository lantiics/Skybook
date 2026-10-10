DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'skybook_reader') THEN
        CREATE ROLE skybook_reader LOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'skybook_writer') THEN
        CREATE ROLE skybook_writer LOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO skybook_reader, skybook_writer;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO skybook_reader, skybook_writer;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO skybook_writer;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO skybook_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO skybook_reader, skybook_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO skybook_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO skybook_writer;