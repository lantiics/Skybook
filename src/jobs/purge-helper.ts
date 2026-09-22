import { config } from "../config";
import { signupEnabled, loginEnabled } from "../domain/service-settings";
import { purgeCache } from "../domain/cache";

let lastSignupChecked: boolean = false;
let lastLoginChecked: boolean = false;
let lastHeaderChecked: string = "";

const tryPurgeSignupCache = async () => {
  const signupStatus = await signupEnabled();
  if (signupStatus !== lastSignupChecked) {
    lastSignupChecked = signupStatus;
    await purgeCache("signup");
  }
};
const tryPurgeLoginCache = async () => {
  const loginStatus = await loginEnabled();
  if (loginStatus !== lastLoginChecked) {
    lastLoginChecked = loginStatus;
    await purgeCache("login");
  }
};
const tryPurgeGlobalCache = async () => {
  const curHeader = config.skybook.header;
  if (curHeader !== lastHeaderChecked) {
    lastHeaderChecked = curHeader;
    await purgeCache("non-static");
  }
};

(async () => {
  setInterval(
    async () => {
      tryPurgeSignupCache();
      tryPurgeLoginCache();
      tryPurgeGlobalCache();
    },
    1 * 60 * 1000, // 1 minute
  );
})();
