-- IP address blocking
CREATE TABLE instance_blocks (
  instance TEXT NOT NULL REFERENCES instances(name) ON DELETE CASCADE ON UPDATE CASCADE,
  ip_hash TEXT NOT NULL,
  user_identifier UUID REFERENCES users(identifier) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  PRIMARY KEY (instance, ip_hash)
);
CREATE UNIQUE INDEX instance_blocks_unique_user ON instance_blocks (instance, user_identifier) WHERE user_identifier IS NOT NULL;
CREATE UNIQUE INDEX instance_blocks_unique_ip ON instance_blocks (instance, ip_hash) WHERE ip_hash IS NOT NULL;

CREATE TABLE ip_block_stats (
  ip_hash TEXT PRIMARY KEY,
  block_count INTEGER NOT NULL DEFAULT 1,
  first_blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_blocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE global_ip_blocks (
  ip_hash TEXT PRIMARY KEY,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

CREATE TABLE user_enforcements (
    id UUID PRIMARY KEY,
    user_identifier UUID NOT NULL REFERENCES users(identifier) ON DELETE CASCADE,
    type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ
);
CREATE INDEX idx_user_enforcements_user_expires_at ON user_enforcements (user_identifier, expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE blocklist_ranges (
  source TEXT NOT NULL,
  range CIDR NOT NULL,
  added TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blocklist_ranges ON blocklist_ranges USING gist (range inet_ops);