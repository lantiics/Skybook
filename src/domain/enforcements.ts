import { DB } from "../db";
import { NotFoundError } from "../errors";
import { revokeAllSessions } from "./sessions";
import { RequestContext } from "../types/context";
import { userUUID } from "./users";
export const userInformation = async (UUID: string) => {
  const [uI] = //enforcements, enforcement_count
    await DB`SELECT name, identifier, can_login, can_post, can_delete_account, created_at, last_seen, is_superadmin FROM users WHERE identifier = ${UUID}`;
  if (uI === undefined) {
    throw new NotFoundError("Requested user could not be found");
  }
  console.log(uI);
  return uI;
};
const userEnforcementStatus = async (name: string) => {
  const UUID = await userUUID(name);
  const [user] =
    await DB`SELECT status FROM user_enforcements WHERE identifier = ${UUID}`;
  if (user === "undefined") return "active";
  return user.status;
};
const recordUserEnforcement = async (
  name: string,
  enforcementAction: "active" | "posting_blocked" | "locked",
  duration: number | null,
): Promise<void> => {
  const UUID = await userUUID(name);
  const currentStatus = await userEnforcementStatus(name);
  if (enforcementAction === currentStatus && enforcementAction !== "active") {
    enforcementAction = "active";
  }
  const now = new Date().toISOString();
  const expiration =
    duration && enforcementAction !== "active"
      ? new Date(Date.now() + duration)
      : null;
  const locked_at = enforcementAction === "locked" ? `${now}` : null;

  const newRecord: Record<
    string,
    { action: string; duration: number | null; expires: Date | null }
  > = {
    [now]: {
      action: enforcementAction,
      duration: duration,
      expires: expiration,
    },
  };

  const [row] =
    await DB`INSERT INTO user_enforcements (identifier, status, locked_at, expires_at, enforcements) VALUES (${UUID},${enforcementAction},${locked_at},${expiration}, ${newRecord})
    ON CONFLICT (identifier) DO UPDATE SET status = ${enforcementAction}, locked_at = ${locked_at}, expires_at = ${expiration}, enforcements = user_enforcements.enforcements || ${newRecord}`;
};

export const recordUserBlocked = async (name: string): Promise<void> => {
  const UUID = await userUUID(name);
  await DB`INSERT INTO user_enforcements (identifier, status, block_count) VALUES (${UUID},active,1)
    ON CONFLICT (identifier) DO UPDATE SET block_count = user_enforcements.block_count + 1`;
};

export const decrementUserBlockedInt = async (name: string): Promise<void> => {
  const UUID = await userUUID(name);
  await DB`UPDATE user_enforcements SET block_count = GREATEST (block_count - 1, 0) WHERE identifier = ${UUID}`;
};

export const toggleUserLocked = async (ctx: RequestContext, name: string) => {
  await DB.begin(async (tx) => {
    await tx`UPDATE users SET can_login = NOT can_login WHERE name = ${name}`;
    await recordUserEnforcement(name, "locked", null);
  });
  await revokeAllSessions(name);
};
export const toggleUserPosting = async (ctx: RequestContext, name: string) => {
  await DB`UPDATE users SET can_post = NOT can_post WHERE name = ${name}`;
};
