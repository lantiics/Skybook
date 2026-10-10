import { SUPERUSER } from "@/db";

console.log(
  `Skybook currently has ${(await SUPERUSER`SELECT COUNT(*) FROM users;`)[0].count} users`,
);
