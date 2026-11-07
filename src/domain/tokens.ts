import { config } from "../config.ts";
import { READER } from "../db.ts";
import { LockedError } from "../errors.ts";
import type { RequestContext } from "../types/context.ts";
import { Post } from "../types/entities";

export const generateToken = (): { token: string; hashed: string } => {
  const token = crypto.randomUUID();
  const hashed = new Bun.CryptoHasher("sha256", process.env.TOKEN_HASH_SECRET)
    .update(token)
    .digest("base64");
  return { token, hashed };
};

export const entryTokenValid = async (
  ctx: RequestContext,
  identifier: Post["identifier"],
): Promise<boolean> => {
  const [{ sys_lock: locked }] =
    await READER`SELECT sys_lock FROM posts WHERE identifier = ${identifier}`;
  if (ctx.elevated && locked) throw new LockedError("Post is locked");
  const token = new Bun.CryptoHasher("sha256", process.env.TOKEN_HASH_SECRET)
    .update(ctx.token ?? "")
    .digest("base64");
  const [row] =
    await READER`SELECT EXISTS(SELECT 1 FROM tokens WHERE instance = ${ctx.instance} AND identifier = ${identifier} AND token = ${token} AND created_at > NOW() - make_interval(hours => ${config.tokens.expiry_hours}))`;
  return row.exists && !locked;
};
