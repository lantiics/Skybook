CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_name TEXT NOT NULL REFERENCES users(name),
  user_identifier UUID NOT NULL REFERENCES users(identifier) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 week')
);
CREATE INDEX CONCURRENTLY sessions_expires_at_idx ON sessions (expires_at);