require("dotenv");

import { WRITER } from "../db";

export const deleteEligibleAccounts = async (): Promise<void> => {
  await WRITER`DELETE FROM users WHERE pending_deletion AND delete_at < now()`;
};