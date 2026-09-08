export interface UserEnforcement {
  readonly reason: string;
  readonly code: string;
  readonly created_at: string;
  readonly expires_at: string | false;
}

export interface User {
  readonly name: string;
  readonly password_hash: string;
  readonly identifier: string;
  readonly ip_hash: string;
  readonly can_login: boolean;
  readonly can_post: boolean;
  readonly created_at: string;
  readonly last_seen: string;
  readonly totp_secret?: string;
}
export interface Session {
  readonly token: string;
  readonly user: string;
  readonly created_at: string;
  readonly expires_at: string;
}

export interface Instance {
  readonly name: string;
  readonly is_visible: boolean;
  readonly submission_enabled: boolean;
  readonly approval_required: boolean;
  readonly flagging_enabled: boolean;
  readonly queue_on_filtered: boolean; // If false we immediately discard filtered posts
}

export interface InstanceIpBlock {
  readonly instance: string;
  readonly ip_hash: string;
  readonly blocked_at: string;
}

export interface IpBlockStats {
  readonly ip_hash: string;
  readonly block_count: number;
  readonly first_blocked_at: Date;
  readonly last_blocked_at: string;
}

export interface Post {
  readonly seq: number;
  readonly instance: string;
  readonly identifier: string;
  readonly ip_hash: string;
  readonly authenticated_user_identifier: string | null;
  readonly last_edited_by: string | null;
  reply: string | null;
  readonly is_visible: boolean;
  is_queued: boolean;
  readonly is_pinned: boolean;
  readonly is_highlighted: boolean;
  readonly can_flag: boolean;
  readonly flag_count: number;
  readonly added: string;
  author: string;
  content: string;
  extra: Record<string, unknown>;
  readonly sys_lock: boolean;
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

export interface UserEnforcement {
  id: string;
  user: string;
  type: "lock" | "block_posting";
  details: string;
  created_at: string;
  expires_at: string | null;
}
