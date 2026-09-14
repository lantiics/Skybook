require("dotenv");

import { config } from "../config";
import { WRITER } from "../db";

const expireOldAccounts = async (): Promise<void> => {
  await WRITER`UPDATE users 
  SET pending_deletion = true,
   delete_at = (now() + make_interval(days => ${config.users.expiration_grace_period_days}))
  WHERE last_seen < (now() - make_interval(days => ${config.users.expiration_threshold_days}))`;
};

expireOldAccounts();
setInterval(expireOldAccounts, config.jobs.expiration_sweep_interval_minutes);
