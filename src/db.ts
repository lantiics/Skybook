import Bun, { sql, SQL } from "bun";
export const DB = new SQL({
  url: process.env.DATABASE_URL,
});

const isSafeSQLString = (str: string) => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
};
