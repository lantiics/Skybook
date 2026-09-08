require("dotenv");

import { config } from "../config";
import { WRITER } from "../db";

const expireOldAccounts = async (): Promise<void> => {
  await WRITER`UPDATE users 
  SET pending_deletion = true,
  delete_at = 
  (now() + INTERVAL 
  '${config.users.expiration_grace_period_days} days'
  ) 
  WHERE last_seen < (
  now() + INTERVAL 
  '${config.users.expiration_threshold_days} days'
  )`;
};

expireOldAccounts();
setInterval(expireOldAccounts, config.jobs.expiration_sweep_interval_minutes);
