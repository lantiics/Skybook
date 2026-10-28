import { READER, WRITER } from "../db.ts";
import { NotFoundError } from "../errors";
import { revokeAllSessions } from "./sessions";
import { RequestContext } from "../types/context";
import { User } from "../types/entities";
export const userInformation = async (
  UUID: User["identifier"],
): Promise<
  Pick<
    User,
    | "name"
    | "identifier"
    | "can_login"
    | "can_post"
    | "created_at"
    | "last_seen"
    | "can_create_invitations"
    | "mfa_enabled"
  >
> => {
  const [uI] =
    await READER`SELECT name, identifier, can_login, can_post, created_at, last_seen, can_create_invitations, mfa_enabled FROM users WHERE identifier = ${UUID}`;
  if (uI === undefined) {
    throw new NotFoundError("Requested user could not be found");
  }
  return uI;
};

/**
 * Records a user enforcement in the user_enforcements
 * database table alongside the date created
 */
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
): Promise<void> => {
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
): Promise<void> => {
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
): Promise<void> => {
  await DB.begin(async (tx) => {
    await tx`UPDATE users SET can_login = NOT can_login WHERE identifier = ${UUID}`;
    await tx`UPDATE instances SET submission_enabled = false, is_visible = false WHERE user_identifier = ${UUID}`;
    await recordUserEnforcement(UUID, "locked", details, null, DB);
  });
  await revokeAllSessions(UUID, DB);
};
export const toggleUserPosting = async (
  ctx: RequestContext,
  name: string,
): Promise<void> => {
  await WRITER`UPDATE users SET can_post = NOT can_post WHERE name = ${name}`;
};
