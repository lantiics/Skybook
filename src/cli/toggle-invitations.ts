import { SUPERUSER } from "@/db";

(async () => {
  const [{ value: state }] =
    await SUPERUSER`UPDATE service_settings SET value = NOT value WHERE name = 'signup_requires_invitation' RETURNING value`;
  console.log(
    `An invitation is ${state ? "now required" : "no longer required"} to sign up to Skybook`,
  );
})();
