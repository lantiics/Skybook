require("dotenv");

import { config } from "../config";
import { SUPERUSER } from "../db";

export const expireOldAccounts = async (): Promise<void> => {
  await SUPERUSER`UPDATE users 
  SET pending_deletion = true,
   delete_at = (now() + make_interval(days => ${config.users.expiration_grace_period_days}))
  WHERE last_seen < (now() - make_interval(days => ${config.users.expiration_threshold_days}))`;
};

export const expireOldInvitations = async (): Promise<void> => {
  await SUPERUSER`DELETE FROM invitations WHERE created_at < (now() - make_interval(hours => ${config.invitations.expiration_period_hours}))`;
};
