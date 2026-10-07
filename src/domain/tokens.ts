import { READER, WRITER } from "../db.ts";
import type { RequestContext } from "../types/context.ts";
import { User } from "../types/entities";

export const generateToken = (): string => {
  return crypto.randomUUID();
};

export const entryTokenValid = async (
  ctx: RequestContext,
  identifier: User["identifier"],
): Promise<boolean> => {
  if (ctx.elevated || ctx.superAdmin) return true;
  const [row] =
    await READER`SELECT EXISTS(SELECT 1 FROM tokens WHERE instance = ${ctx.instance} AND identifier = ${identifier} AND token = ${ctx.token ?? ""} AND created_at > NOW() - make_interval(hours => ${config.tokens.expiry_hours}))`;
  return row.exists;
};

export const clearExpiredTokens = () => {
  WRITER`DELETE FROM tokens WHERE expires_at<=${Date.now()}`;
};
