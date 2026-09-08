require("dotenv");
import { sql } from "bun";
import { WRITER } from "../db";
import { UserEnforcement } from "../types/entities";
import { config } from "../config";

const unblockLapsedIps = async (): Promise<void> => {
  await WRITER`DELETE FROM global_ip_blocks WHERE blocked_at < NOW - INTERVAL '30 days'`;
  await WRITER`DELETE FROM instance_blocks WHERE user_identifier IS NULL AND ip_hash IS NOT NULL AND blocked_at < NOW() - INTERVAL '60 days'`;
};

const liftUserEnforcements = async () => {
  const expiredEnforcements =
    await WRITER`SELECT user,type FROM user_enforcements WHERE expires_at < NOW()`;

  for (const enforcement of Object.values(
    expiredEnforcements,
  ) as UserEnforcement[]) {
    let $QUERY;
    switch (enforcement.type) {
      case "lock":
        $QUERY = "can_login = true, can_post = true";
        break;
      case "block_posting":
        $QUERY = "can_post = true";
        break;
      default:
        continue;
    }
    await WRITER`UPDATE usets SET ${WRITER.unsafe($QUERY)} WHERE identifier = ${enforcement.user}`;
  }
};

unblockLapsedIps();
liftUserEnforcements();

setInterval(() => {
  (unblockLapsedIps(), liftUserEnforcements());
}, config.jobs.lift_enforcements_interval_minutes);
