CREATE TABLE users (
  identifier UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(15) UNIQUE NOT NULL,
  ip_hash TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  mfa_recovery TEXT[],
  can_login BOOLEAN NOT NULL DEFAULT TRUE,
  can_post BOOLEAN NOT NULL DEFAULT TRUE,
  can_delete_account BOOLEAN NOT NULL DEFAULT TRUE,
  can_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  can_change_username BOOLEAN NOT NULL DEFAULT FALSE,
  can_create_invitations BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  pending_deletion BOOLEAN NOT NULL DEFAULT FALSE,
  delete_at TIMESTAMPTZ,
  can_be_blocked BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(identifier)
);
CREATE UNIQUE INDEX idx_username ON users (name);
CREATE INDEX idx_users_pending_deletion ON users (delete_at) WHERE pending_deletion IS TRUE;

CREATE TABLE instances (
  name TEXT PRIMARY KEY REFERENCES users(name) ON DELETE CASCADE ON UPDATE CASCADE,
  user_identifier UUID UNIQUE NOT NULL REFERENCES users(identifier) ON DELETE CASCADE ON UPDATE CASCADE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE, -- -- -- --  -- --
  submission_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- -- --
  --replying_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  flagging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  queue_on_filtered BOOLEAN NOT NULL DEFAULT TRUE,
  enforced_lock BOOLEAN NOT NULL DEFAULT FALSE,
  custom_filter TEXT,
  queue_flags_threshold INTEGER NOT NULL DEFAULT 3,
  blocklist_proxy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  blocklist_vpn_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  blocklist_tor_enabled BOOLEAN NOT NULL DEFAULT FALSE
);


CREATE TABLE fields (
  instance TEXT NOT NULL REFERENCES instances(name) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_special BOOLEAN NOT NULL DEFAULT FALSE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  replacement TEXT,
  filter TEXT,
  PRIMARY KEY (instance, name)
);
CREATE TABLE posts (
  seq BIGSERIAL PRIMARY KEY,
  instance TEXT NOT NULL REFERENCES instances(name) ON DELETE CASCADE ON UPDATE CASCADE,
  ip_hash TEXT NOT NULL,
  identifier TEXT UNIQUE NOT NULL,
  authenticated_user_identifier UUID REFERENCES users(identifier) ON DELETE SET NULL,
  last_edited_by UUID REFERENCES users(identifier) ON DELETE SET NULL,
  reply TEXT,
  author TEXT NOT NULL DEFAULT 'anonymous',
  content TEXT NOT NULL,
  extra JSONB NOT NULL DEFAULT '{}',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_queued BOOLEAN NOT NULL DEFAULT FALSE,
  flag_count INTEGER NOT NULL DEFAULT 0,
  can_flag BOOLEAN NOT NULL DEFAULT TRUE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  added TIMESTAMPTZ NOT NULL DEFAULT now(),
  --can_reply BOOLEAN NOT NULL DEFAULT TRUE,
  can_block BOOLEAN NOT NULL DEFAULT TRUE,
  sys_lock BOOLEAN NOT NULL DEFAULT FALSE, 
  UNIQUE (instance, identifier)
);

CREATE TABLE post_flags (
  instance TEXT NOT NULL REFERENCES instances(name) ON DELETE CASCADE,
  identifier TEXT NOT NULL REFERENCES posts(identifier) ON DELETE CASCADE,
  user_identifier UUID REFERENCES users(identifier) ON DELETE SET NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX post_flags_unique_ip ON post_flags (instance, identifier, ip_hash);
CREATE UNIQUE INDEX post_flags_unique_user ON post_flags (instance, identifier, user_identifier) WHERE user_identifier IS NOT null;
CREATE TABLE tokens (
  instance TEXT NOT NULL,
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (instance, identifier)
);
CREATE INDEX CONCURRENTLY tokens_expires_at_idx ON tokens (expires_at);
CREATE TABLE invitations (
  token TEXT PRIMARY KEY NOT NULL,
  created_by UUID NOT NULL REFERENCES users(identifier) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used TIMESTAMPTZ,
  uses INTEGER NOT NULL DEFAULT 0,
  UNIQUE (token)
);
CREATE TABLE overrides (
  instance TEXT REFERENCES instances(name),
  name TEXT NOT NULL CHECK (name IN (
  'is_visible', 'submission_enabled', 'replying_enabled', 'approval_required', 'flagging_enabled', 'queue_on_filtered'
  )),
  value BOOLEAN NOT NULL,
  UNIQUE (instance, name)
);
CREATE UNIQUE INDEX overrides_global_uidx ON overrides (name) WHERE instance IS NULL;
CREATE UNIQUE INDEX overrides_instance_uidx ON overrides (instance, name) WHERE instance IS NOT NULL;

CREATE TABLE service_settings (
  name TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL,
  message TEXT
);
INSERT INTO service_settings (name, value) VALUES ('signup_enabled', false), ('totp_enabled', true),('login_enabled',true),('account_deletion_enabled',true);
