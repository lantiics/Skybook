import { SUPERUSER } from "@/db";
const identifier = Bun.argv[2];
(async () => {
  const state = await SUPERUSER.begin(async (tx) => {
    const [state] =
      await tx`UPDATE posts SET sys_lock = NOT sys_lock WHERE identifier = ${identifier} RETURNING sys_lock`;
    return state;
  });
  console.log(
    `The entry with ID '${identifier}' is now ${state.sys_lock ? "locked" : "unlocked"}`,
  );
})();
