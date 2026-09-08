import { READER, WRITER } from "../db.ts";
import type { RequestContext } from "../types/context.ts";

export const generateToken = (): string => {
  return crypto.randomUUID();
};

export const entryTokenValid = async (
  ctx: RequestContext,
  identifier: string,
): Promise<boolean> => {
  if (ctx.elevated || ctx.superAdmin) return true;
  const [row] =
    await READER`SELECT EXISTS(SELECT 1 FROM tokens WHERE instance = ${ctx.instance} AND identifier = ${identifier} AND token = ${ctx.token ?? ""} AND created_at > NOW() - INTERVAL '1 day')`;
  return row.exists;
};

export const clearExpiredTokens = () => {
  WRITER`DELETE FROM tokens WHERE expires_at<=${Date.now()}`;
};
