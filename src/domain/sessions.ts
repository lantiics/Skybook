import { DB } from "../db.ts";
import { UnauthorizedError } from "../errors.ts";
import { RequestContext } from "../types/context";
import { generateToken } from "./tokens.ts";
import { randomBytes } from "node:crypto";
import Bun from "bun";
import { userIsSuperAdmin } from "./users.ts";
const generateSessionKey = async (): Promise<string> => {
  const token = randomBytes(32).toString("hex");
  return token;
};

export const userIdentifier = async (user: string): Promise<string> => {
  const [identifier] =
    await DB`SELECT identifier FROM users WHERE name = ${user}`;
  return identifier.identifier;
};
export const createSession = async (user: string): Promise<string> => {
  console.time("Generated session key");
  const token = await generateSessionKey();
  const tokenHash = new Bun.CryptoHasher("sha256").update(token).digest("hex");
  console.log(await userIdentifier(user));
  await DB`INSERT INTO sessions (token, user_name, user_identifier) VALUES (${tokenHash}, ${user}, ${await userIdentifier(user)} )`;
  console.timeEnd("Generated session key");
  return token;
};

export const getSessionUser = async (
  token: string,
): Promise<RequestContext["user"]> => {
  const [row] =
    await DB`SELECT user_name,user_identifier FROM sessions WHERE token = ${new Bun.CryptoHasher("sha256").update(token).digest("hex")} AND expires_at > now()`;
  if (!row) {
    throw new UnauthorizedError("There is no specified session key available");
  }

  return {
    name: row.user_name,
    identifier: row.user_identifier,
    superAdmin: await userIsSuperAdmin(row.user_identifier),
  };
};

export const revokeSession = async (token: string): Promise<void> => {
  await DB`DELETE FROM sessions WHERE token = ${token}`;
};
export const revokeAllSessions = async (identifier: string): Promise<void> => {
  await DB`DELETE FROM sessions WHERE user_identifier = ${identifier}`;
};
export const clearExpiredSessions = async (): Promise<void> => {
  await DB`DELETE FROM sessions WHERE expires_at <= now()`;
};
