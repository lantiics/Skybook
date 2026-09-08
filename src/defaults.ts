import type { Post, Instance } from "./types/entities.ts";

export const PUBLIC_COLUMN_NAMES: Set<keyof Post> = new Set([
  "seq",
  "identifier",
  "authenticated_user_identifier",

  "author",
  "content",
  "extra",
  "added",
  "can_flag",
  "reply",
  "is_pinned",
  "is_highlighted",
  "sys_lock",
  "ip_hash",
  "is_visible",
  "is_queued",
]);
export const PRIVATE_COLUMN_NAMES: Set<keyof Post> = new Set([
  ...PUBLIC_COLUMN_NAMES,
  "last_edited_by",
  "instance",

  "flag_count",
]);
export const ADMIN_COLUMN_NAMES: Set<keyof Post> = new Set([]);
export const SYSTEM_COLUMN_NAMES: Set<keyof Post> = new Set([
  ...PUBLIC_COLUMN_NAMES,
  ...PRIVATE_COLUMN_NAMES,
  ...ADMIN_COLUMN_NAMES,
]);
export const RESERVED_COLUMN_NAMES: Set<keyof Post> = new Set([
  ...PUBLIC_COLUMN_NAMES,
  ...PRIVATE_COLUMN_NAMES,
  ...SYSTEM_COLUMN_NAMES,
]);

// export const PUBLICLY_WRITABLE_COLUMN_NAMES: Set<keyof Post|string> = new Set([''])

export const DEFAULT_INSTANCE_STATUS: Omit<
  Instance,
  "name" | "queue_on_filtered"
> = {
  is_visible: true,
  submission_enabled: true,
  approval_required: false,
  flagging_enabled: true,
};
