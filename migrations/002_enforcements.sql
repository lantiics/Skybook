-- IP address blocking
CREATE TABLE instance_blocks (
  instance TEXT NOT NULL REFERENCES instances(name) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  user_identifier UUID REFERENCES users(identifier) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance, ip_hash)
);
CREATE INDEX instance_blocks_iphash_idx ON instance_blocks (ip_hash);
CREATE INDEX instance_blocks_user_idx ON instance_blocks (user_identifier);

CREATE TABLE ip_block_stats (
  ip_hash TEXT PRIMARY KEY,
  block_count INTEGER NOT NULL DEFAULT 1,
  first_blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_blocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE global_blocks (
  ip_hash TEXT PRIMARY KEY,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

CREATE TABLE user_enforcements (
    identifier UUID PRIMARY KEY REFERENCES users(identifier) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active','posting_blocked','locked')),
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    enforcements JSONB NOT NULL DEFAULT '{}',
    block_count INTEGER NOT NULL DEFAULT 0
)