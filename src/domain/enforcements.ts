import { READER, WRITER } from "../db.ts";
import { NotFoundError } from "../errors";
import { revokeAllSessions } from "./sessions";
import { RequestContext } from "../types/context";
import { userUUID } from "./users";
import { config } from "../config.ts";
export const userInformation = async (UUID: string) => {
  const [uI] =
    await READER`SELECT name, identifier, can_login, can_post, can_delete_account, created_at, last_seen, can_create_invitations, totp_secret FROM users WHERE identifier = ${UUID}`;
  if (uI === undefined) {
    throw new NotFoundError("Requested user could not be found");
  }
  console.log(uI);
  return uI;
};
const userEnforcementStatus = async (name: string) => {
  const UUID = await userUUID(name);
  const [user] =
    await READER`SELECT status FROM user_enforcements WHERE identifier = ${UUID}`;
  if (user === "undefined") return "active";
  return user.status;
};
const recordUserEnforcement = async (
  UUID: string,
  enforcementAction: "posting_blocked" | "locked",
  details: string = "No reason specified",
  duration: number | null,
  DB = WRITER,
): Promise<void> => {
  const now = new Date().toISOString();
  const expires = duration ? new Date(Date.now() + duration) : null;
  const created = enforcementAction === "locked" ? `${now}` : null;
  const enforcementID = crypto.randomUUID();
  const [row] =
    await DB`INSERT INTO user_enforcements (id, user_identifier, type, details,created_at, expires_at) VALUES (${enforcementID},${UUID},${enforcementAction},${details},${created},${expires})`;
};

/**
 *
 * @param identifier - The user's UUID
 * @param duration - (In milliseconds): How long to keep this enforcement on a user
 */
const temporarilyLockUser = async (
  UUID: string,
  duration: number,
  details: string,
) => {
  await WRITER.begin(async (tx) => {
    await tx`UPDATE users SET can_login = NOT can_login WHERE identifier = ${UUID}`;
    await revokeAllSessions(UUID, tx);
    await recordUserEnforcement(UUID, "locked", details, duration, tx);
  });
};

/**
 *
 * @param identifier - The user's UUID
 * @param duration - (In milliseconds): How long to keep this enforcement on a user
 */
const temporarilyBlockUserPosting = async (
  UUID: string,
  duration: number,
  details: string,
) => {
  await WRITER.begin(async (tx) => {
    await tx`UPDATE users SET can_post = NOT can_post WHERE identifier = ${UUID}`;
    await revokeAllSessions(UUID, tx);
    await recordUserEnforcement(UUID, "posting_blocked", details, duration, tx);
  });
};

export const toggleUserLocked = async (
  details: string,
  UUID: string,
  DB = WRITER,
) => {
  await DB.begin(async (tx) => {
    await tx`UPDATE users SET can_login = NOT can_login WHERE name = ${UUID}`;
    await tx`UPDATE instances SET submission_enabled = false, is_visible = false WHERE user_identifier = ${UUID}`;
    await recordUserEnforcement(UUID, "locked", details, null, DB);
  });
  await revokeAllSessions(UUID, DB);
};
export const toggleUserPosting = async (ctx: RequestContext, name: string) => {
  await WRITER`UPDATE users SET can_post = NOT can_post WHERE name = ${name}`;
};

export const tryUserEnforcement = async (UUID: string, DB = READER) => {
  if (!config.skybook.user_enforcements_enabled) return;
  const history =
    await DB`SELECT id,type,created_at,expires_at FROM user_enforcements WHERE user_identifier = ${UUID}`;

  const frequency: [string, string][] = []; // created,expires
  const [f] =
    await DB`SELECT COUNT(*) FROM instance_blocks WHERE user_identifier = ${UUID} AND blocked_at > NOW() - INTERVAL '30 days'`;
  const [l] =
    await DB`SELECT COUNT(*) FROM instance_blocks WHERE user_identifier = ${UUID} AND blocked_at > NOW() - INTERVAL '240 days'`;
  const longUserBlocks = l.count;
  const userBlocks = f.count;
  let enforced = false;
  for (const enforcement of history) {
    frequency.push([enforcement.created_at, enforcement.expires_at]);
  }
  if (frequency.length >= 3) {
    await toggleUserLocked("SYSTEM: Exceeded enforcement threshold", UUID);
    enforced = true;
  }
  if (!enforced) {
    switch (userBlocks) {
      case 3:
        await temporarilyBlockUserPosting(
          UUID,
          2 * 24 * 60 * 60 * 1000,
          "SYSTEM: Exceeded 30 day block threshold",
        );
        break;
      case 5:
        await temporarilyLockUser(
          UUID,
          2 * 24 * 60 * 60 * 1000,
          "SYSTEM: Exceeded 30 day block threshold",
        );
        break;
    }
    if (userBlocks >= 6 || longUserBlocks >= 9)
      await toggleUserLocked("SYSTEM: Exceeded block threshold", UUID);
  }
  return;
};

export const tryGlobalBlock = async (
  ipHash: string,
  blockCount: number,
  DB = WRITER,
): Promise<void> => {
  if (
    !config.ip_blocking.automated_enforcements_enabled ||
    blockCount < config.ip_blocking.global_block_threshold
  )
    return;
  await globalBlock(ipHash, DB);
};

export const globalBlock = async (ipHash: string, DB = WRITER) => {
  await DB`
    INSERT INTO global_ip_blocks (ip_hash, reason) VALUES (${ipHash}, ${DB`SYSTEM: Exceeded per-instance block threshold of ${config.ip_blocking.global_block_threshold}`})
    ON CONFLICT (ip_hash) DO NOTHING`;
};
