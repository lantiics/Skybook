import { doProxy, doVpn, doTor } from "./update-ip-lists";
import { expireOldAccounts } from "./expire-accounts";
import { unblockLapsedIps, liftUserEnforcements } from "./lift-enforcements";
import { tryPurgeGlobalCache, tryPurgeLoginCache, tryPurgeSignupCache } from "./purge-helper";
import { deleteEligibleAccounts } from "./scheduled-account-deletion";

const hourly = Bun.cron("0 * * * *", async ()=> {
    await deleteEligibleAccounts()
    await unblockLapsedIps()
    await liftUserEnforcements()
    await expireOldAccounts()
    await doProxy()
    await doVpn()
    await doTor()
})

const minutely = Bun.cron("*/1 * * * *", async ()=> {
    await tryPurgeGlobalCache()
    await tryPurgeLoginCache()
    await tryPurgeSignupCache()
})

hourly.unref()
minutely.unref()