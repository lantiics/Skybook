import Bun, { sql, SQL } from "bun";
export const READER = new SQL({
  url: process.env.READ_DB_URL,
});

export const WRITER = new SQL({
  url: process.env.WRITE_DB_URL,
});

const isSafeSQLString = (str: string) => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
};
