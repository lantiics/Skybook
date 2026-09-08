require("dotenv");

import { WRITER } from "../db";

const deleteEligibleAccounts = async (): Promise<void> => {
  await WRITER`DELETE FROM users WHERE pending_deletion AND delete_at < now()`;
};

deleteEligibleAccounts();
setInterval(deleteEligibleAccounts, 60 * 60 * 1000); // 60 minutes
