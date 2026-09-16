import { SQL } from "bun";
export const READER = new SQL({
  url: process.env.READ_DB_URL,
});

export const WRITER = new SQL({
  url: process.env.WRITE_DB_URL,
});
