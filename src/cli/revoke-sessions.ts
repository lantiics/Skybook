import { SUPERUSER } from "@/db";

await SUPERUSER`DELETE FROM sessions`;
console.log("All Skybook sessions have been revoked");
