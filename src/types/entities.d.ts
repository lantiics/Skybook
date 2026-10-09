export interface User {
  readonly identifier: string;
  readonly name: string;
  readonly ip_hash: string;
  readonly password_hash: string;
  readonly totp_secret?: string;
  readonly mfa_recovery?: string[];
  readonly mfa_enabled: boolean;
  readonly can_login: boolean;
  readonly can_post: boolean;
  readonly can_change_password: boolean;
  readonly can_change_usernames: boolean;
  readonly can_create_invitations: boolean;
  readonly created_at: Date;
  readonly last_seen: Date;
  readonly pending_deletion: boolean;
  readonly delete_at: Date;
  readonly can_be_blocked: boolean;
}

export interface Session {
  readonly token: string;
  readonly user_name: string;
  readonly user_identifier: string;
  readonly created_at: Date;
  readonly expires_at: Date;
}

export interface Instance {
  readonly name: string;
  readonly user_identifier: string;
  readonly is_visible: boolean;
  readonly submission_enabled: boolean;
  readonly approval_required: boolean;
  readonly flagging_enabled: boolean;
  readonly queue_on_filtered: boolean;
  readonly enforced_lock: boolean;
  readonly custom_filter?: string;
  readonly notification_endpoint?: string;
  readonly notification_service?: string;
  readonly queue_flags_threshold: number;
  readonly blocklist_proxy_enabled: boolean;
  readonly blocklist_vpn_enabled: boolean;
  readonly blocklist_tor_enabled: boolean;
}

export interface Field {
  readonly instance: string;
  readonly name: string;
  readonly is_public: boolean;
  readonly is_special: boolean;
  readonly is_required: boolean;
  readonly replacement?: string;
  readonly filter?: string;
}

export interface Post {
  readonly seq: bigint;
  readonly instance: string;
  readonly ip_hash: string;
  readonly identifier: string;
  readonly authenticated_user_identifier?: string;
  readonly last_edited_by?: string;
  readonly reply?: string;
  readonly author: string;
  readonly content: string;
  readonly extra: Record<string, string>;
  readonly is_visible: boolean;
  readonly is_queued: boolean;
  readonly flag_count: number;
  readonly can_flag: boolean;
  readonly is_pinned: boolean;
  readonly is_highlighted: boolean;
  readonly added: Date;
  readonly can_block: boolean;
  readonly sys_lock: boolean;
}

export interface PostFlag {
  readonly instance: string;
  readonly identifier: string;
  readonly user_identifier: string;
  readonly ip_hash: string;
  readonly created_at: Date;
}

export interface Token {
  readonly instance: string;
  readonly identifier: string;
  readonly token: string;
  readonly expires_at: Date;
  readonly created_at: Date;
}

export interface Invitation {
  readonly token: string;
  readonly created_by: string;
  readonly created_at: Date;
  readonly last_used?: Date;
  readonly uses: number;
}

export interface Override {
  readonly instance: string;
  readonly name:
    | "is_visible"
    | "submission_enabled"
    | "approval_required"
    | "flagging_enabled"
    | "queue_on_filtered";
  readonly value: boolean;
}

export interface ServiceSetting {
  readonly name: string;
  readonly value: boolean;
  readonly message?: string;
}

export interface InstanceBlock {
  readonly instance: string;
  readonly ip_hash: string;
  readonly ip_hash: string;
  readonly user_identifier: string;
  readonly blocked_at: Date;
  readonly reason?: string;
}

export interface IpBlockStat {
  readonly ip_hash: string;
  readonly block_count: number;
  readonly first_blocked_at: Date;
  readonly last_blocked_at: Date;
}

export interface GlobalIpBlock {
  readonly ip_hash: string;
  readonly blocked_at: Date;
  readonly reason?: string;
}

export interface UserEnforcement {
  readonly id: string;
  readonly user_identifier: string;
  readonly type: string;
  readonly details: string;
  readonly created_at: Date;
  readonly expires_at?: Date;
}

export interface BlocklistRange {
  readonly source: string;
  readonly range: string;
  readonly added: Date;
}

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
