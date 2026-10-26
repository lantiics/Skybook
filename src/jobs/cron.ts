import { doProxy, doVpn, doTor } from "./update-ip-lists";
import {
  expireOldAccounts,
  expireOldInvitations,
  unblockLapsedIps,
} from "./expirations";
import {
  tryPurgeGlobalCache,
  tryPurgeLoginCache,
  tryPurgeSignupCache,
} from "./purge-helper";
import { deleteEligibleAccounts } from "./scheduled-account-deletion";

const hourly = Bun.cron("0 * * * *", async () => {
  await deleteEligibleAccounts();
  await expireOldAccounts();
  await expireOldInvitations();
  await unblockLapsedIps();
  await doProxy();
  await doVpn();
  await doTor();
});

const minutely = Bun.cron("*/1 * * * *", async () => {
  await tryPurgeGlobalCache();
  await tryPurgeLoginCache();
  await tryPurgeSignupCache();
});

hourly.unref();
minutely.unref();
