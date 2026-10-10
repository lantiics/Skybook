import { SUPERUSER } from "@/db";

(async () => {
  const [{ value: state }] =
    await SUPERUSER`UPDATE service_settings SET value = NOT value WHERE name = 'signup_enabled' RETURNING value`;
  console.log(`Signup is now ${state ? "enabled" : "disabled"}`);
})();
