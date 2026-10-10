import { SUPERUSER } from "@/db";
const user = Bun.argv[2];
(async () => {
  const state = await SUPERUSER.begin(async (tx) => {
    await tx`DELETE FROM sessions WHERE user_name = ${user}`;
    const [state] =
      await tx`UPDATE users SET can_login = NOT can_login WHERE name = ${user} RETURNING can_login`;
    await tx`UPDATE instances SET is_visible = false, submission_enabled = false WHERE name = ${user}`;
    return state;
  });
  console.log(
    `The account '${user}' is now ${!state.can_login ? "locked" : "unlocked"}`,
  );
})();
