export interface UserEnforcement {
  reason: string;
  code: string;
  created_at: string;
  expires_at: string | false;
}

export interface User {
  name: string;
  password_hash: string;
  identifier: string;
  ip_hash: string;
  can_login: boolean;
  can_post: boolean;
  created_at: string;
  enforcements: Record<string, UserEnforcement>;
  enforcement_level: number;
  last_seen: string;
  totp_secret?: string;
}
export interface Session {
  token: string;
  user: string;
  created_at: string;
  expires_at: string;
}

export interface Instance {
  name: string;
  is_visible: boolean;
  submission_enabled: boolean;
  replying_enabled: boolean;
  approval_required: boolean;
  flagging_enabled: boolean;
  queue_on_filtered: boolean; // If false we immediately discard filtered posts
}

export interface InstanceIpBlock {
  instance: string;
  ip_hash: string;
  blocked_at: string;
}

export interface IpBlockStats {
  ip_hash: string;
  block_count: number;
  first_blocked_at: Date;
  last_blocked_at: string;
}

export interface Post {
  seq: number;
  instance: string;
  sub_instance: string;
  identifier: string;
  ip_hash: string;
  authenticated_user_identifier: string | null;
  parent: string | null;
  is_visible: boolean;
  is_queued: boolean;
  is_pinned: boolean;
  is_highlighted: boolean;
  can_flag: boolean;
  can_reply: boolean;
  flag_count: number;
  added: string;

  author: string;
  content: string;
  extra: Record<string, unknown>;

  sys_lock: boolean;
}
export interface Field {
  instance: string;
  name: string;
  is_public: boolean;
  is_special: boolean;
  is_required: boolean;
  replacement: string | null;
  filter: string | null;
}

export interface Token {
  instance: string;
  sub_instance: string;
  identifier: string;
  token: string;
  expires_at: number;
}
export interface Override {
  instance: string | null;
  name:
    | "is_visible"
    | "submission_enabled"
    | "replying_enabled"
    | "requires_approval"
    | "flagging_enabled"
    | "queue_on_filtered";
  value: boolean;
}

export interface GlobalIpBlock {
  ip_hash: string;
  blocked_at: string;
  reason?: string;
}
