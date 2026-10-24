import { config } from "../config.ts";
import { READER, WRITER } from "../db.ts";
import type { RequestContext } from "../types/context.ts";
import { User } from "../types/entities";

export const generateToken = (): { token: string; hashed: string } => {
  const token = crypto.randomUUID();
  const hashed = new Bun.CryptoHasher("sha256", process.env.TOKEN_HASH_SECRET)
    .update(token)
    .digest("base64");
  return { token, hashed };
};

export const entryTokenValid = async (
  ctx: RequestContext,
  identifier: User["identifier"],
): Promise<boolean> => {
  if (ctx.elevated) return true;
  const token = new Bun.CryptoHasher("sha256", process.env.TOKEN_HASH_SECRET)
    .update(ctx.token ?? "")
    .digest("base64");
  const [row] =
    await READER`SELECT EXISTS(SELECT 1 FROM tokens WHERE instance = ${ctx.instance} AND identifier = ${identifier} AND token = ${token} AND created_at > NOW() - make_interval(hours => ${config.tokens.expiry_hours}))`;
  return row.exists;
};

export const clearExpiredTokens = () => {
  WRITER`DELETE FROM tokens WHERE expires_at<=${Date.now()}`;
};
