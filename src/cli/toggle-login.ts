import { SUPERUSER } from "@/db";

(async () => {
  const [{ value: state }] =
    await SUPERUSER`UPDATE service_settings SET value = NOT value WHERE name = 'login_enabled' RETURNING value`;
  console.log(`Login is now ${state ? "enabled" : "disabled"}`);
})();
