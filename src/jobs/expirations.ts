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

// Guestbook owners can block the creator of a post.
// This blocks the IP used by the post creator (or, a hash of said IP).
// IP addresses are not indefinite identifiers, so we expire all IP-based blocks after 60 days.
export const unblockLapsedIps = async (): Promise<void> => {
  await SUPERUSER`DELETE FROM instance_blocks WHERE user_identifier IS NULL AND ip_hash IS NOT NULL AND blocked_at < NOW() - INTERVAL '60 days'`;
};
