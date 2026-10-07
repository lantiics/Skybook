require("dotenv");
import { WRITER } from "../db";
import { UserEnforcement } from "../types/entities";
import { config } from "../config";

export const unblockLapsedIps = async (): Promise<void> => {
  await WRITER`DELETE FROM global_ip_blocks WHERE blocked_at < NOW() - INTERVAL '30 days'`;
  await WRITER`DELETE FROM instance_blocks WHERE user_identifier IS NULL AND ip_hash IS NOT NULL AND blocked_at < NOW() - INTERVAL '60 days'`;
};

export const liftUserEnforcements = async () => {
  const expiredEnforcements =
    await WRITER`SELECT user_identifier,type FROM user_enforcements WHERE expires_at IS NOT NULL AND expires_at < NOW() AND NOT is_expired`;

  for (const enforcement of Object.values(
    expiredEnforcements,
  ) as UserEnforcement[]) {
    let $QUERY;
    switch (enforcement.type) {
      case "locked":
        $QUERY = "can_login = true, can_post = true";
        break;
      case "posting_blocked":
        $QUERY = "can_post = true";
        break;
      default:
        continue;
    }

    await WRITER`UPDATE user_enforcements SET is_expired = true WHERE id = ${enforcement.id}`
    await WRITER`UPDATE users SET ${WRITER.unsafe($QUERY)} WHERE identifier = ${enforcement.user_identifier}`;
  }
};