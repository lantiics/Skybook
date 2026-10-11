import { READER, WRITER } from "../db.ts";
import { UnauthorizedError } from "../errors.ts";
import { RequestContext } from "../types/context";
import { randomBytes } from "node:crypto";
import Bun from "bun";
import { userInformation } from "./enforcements.ts";
import { Session, User } from "../types/entities";
import { config } from "../config.ts";
const generateSessionKey = async (): Promise<string> => {
  const token = randomBytes(32).toString("hex");
  return token;
};

export const userIdentifier = async (user: User["name"]): Promise<string> => {
  const [identifier] =
    await READER`SELECT identifier FROM users WHERE name = ${user}`;
  return identifier.identifier;
};
export const createSession = async (
  name: User["name"],
  DB = WRITER,
): Promise<string> => {
  const token = await generateSessionKey();
  const tokenHash = new Bun.CryptoHasher("sha256").update(token).digest("hex");

  await DB`INSERT INTO sessions (token, user_name, user_identifier, expires_at) VALUES (${tokenHash}, ${name}, ${await userIdentifier(name)}, (NOW() + make_interval(days => ${config.sessions.expiry_days})))`;

  return token;
};

export const getSessionUser = async (
  token: Session["token"],
): Promise<RequestContext["user"]> => {
  const [row] =
    await READER`SELECT user_name,user_identifier FROM sessions WHERE token = ${new Bun.CryptoHasher("sha256").update(token).digest("hex")} AND expires_at > now()`;
  if (!row) {
    throw new UnauthorizedError("There is no specified session key available");
  }
  const uData = await userInformation(row.user_identifier);
  return {
    name: row.user_name,
    identifier: row.user_identifier,
    mfaEnabled: uData.mfa_enabled,
    can_create_invitations: uData.can_create_invitations,
  };
};

export const revokeSession = async (token: Session["token"]): Promise<void> => {
  token = new Bun.CryptoHasher("sha256").update(token).digest("hex");
  const r = await WRITER`DELETE FROM sessions WHERE token = ${token}`;
  console.log(r, "a");
};
export const revokeAllSessions = async (
  identifier: User["identifier"],
  DB: any = WRITER,
): Promise<void> => {
  const r =
    await DB`DELETE FROM sessions WHERE user_identifier = ${identifier}`;
};
export const clearExpiredSessions = async (): Promise<void> => {
  await WRITER`DELETE FROM sessions WHERE expires_at <= now()`;
};
