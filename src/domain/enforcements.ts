import { READER, WRITER } from "../db.ts";
import { NotFoundError } from "../errors";
import { revokeAllSessions } from "./sessions";
import { RequestContext } from "../types/context";
import { userUUID } from "./users";
import { User } from "../types/entities";
export const userInformation = async (UUID: User["identifier"]) => {
  const [uI] =
    await READER`SELECT name, identifier, can_login, can_post, created_at, last_seen, can_create_invitations, mfa_enabled FROM users WHERE identifier = ${UUID}`;
  if (uI === undefined) {
    throw new NotFoundError("Requested user could not be found");
  }
  return uI;
};
const userEnforcementStatus = async (name: User["name"]) => {
  const UUID = await userUUID(name);
  const [user] =
    await READER`SELECT status FROM user_enforcements WHERE identifier = ${UUID}`;
  if (user === "undefined") return "active";
  return user.status;
};
const recordUserEnforcement = async (
  UUID: User["identifier"],
  enforcementAction: "posting_blocked" | "locked",
  details: string = "No reason specified",
  duration: number | null,
  DB = WRITER,
): Promise<void> => {
  const now = new Date().toISOString();
  const expires = duration ? new Date(Date.now() + duration) : null;
  const enforcementID = crypto.randomUUID();
  const [row] =
    await DB`INSERT INTO user_enforcements (id, user_identifier, type, details,created_at, expires_at, is_expired) VALUES (${enforcementID},${UUID},${enforcementAction},${details},${now},${expires}, false)`;
};

/**
 *
 * @param identifier - The user's UUID
 * @param duration - (In milliseconds): How long to keep this enforcement on a user
 */
const temporarilyLockUser = async (
  UUID: User["identifier"],
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
  UUID: User["identifier"],
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
  UUID: User["identifier"],
  DB = WRITER,
) => {
  await DB.begin(async (tx) => {
    await tx`UPDATE users SET can_login = NOT can_login WHERE identifier = ${UUID}`;
    await tx`UPDATE instances SET submission_enabled = false, is_visible = false WHERE user_identifier = ${UUID}`;
    await recordUserEnforcement(UUID, "locked", details, null, DB);
  });
  await revokeAllSessions(UUID, DB);
};
export const toggleUserPosting = async (ctx: RequestContext, name: string) => {
  await WRITER`UPDATE users SET can_post = NOT can_post WHERE name = ${name}`;
};
