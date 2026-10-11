require("dotenv");

import { SUPERUSER } from "../db";

export const deleteEligibleAccounts = async (): Promise<void> => {
  await SUPERUSER`DELETE FROM users WHERE pending_deletion AND delete_at < now()`;
};
