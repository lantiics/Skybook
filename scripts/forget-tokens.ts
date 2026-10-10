import { SUPERUSER } from "@/db";

await SUPERUSER`DELETE FROM tokens`;
console.log("All tokens associated with Skybook posts have been forgotten");
