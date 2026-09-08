import { RedisClient } from "bun";
import { NextFunction, Request, Response } from "express";

const redis = new RedisClient("redis://localhost:6379", {
  autoReconnect: true,
  maxRetries: 10, // NEEDS REVIEW
});

const rateLimit = async (
  ip: string,
  limit: number = 20,
  windowMs: number = 60000,
) => {
  const key = `ratelimit:${ip}`;
  console.log(key);
  const count = await redis.incr(key);
  console.log(count);

  if (count === 1) {
    await redis.expire(key, windowMs / 1000);
  }
  console.log(limit, "limit");

  const remaining = Math.max(0, limit - count);
  const limited = count > limit;
  console.log(remaining, "remaining");
  return {
    limited,
    remaining,
    reset: await redis.ttl(key),
  };
};
export const limiter = (opts: any = {}) => {
  // const limit = await rateLimit(req.ip);
  const {
    windowMs = 60000,
    limit = 30,
    // standardHeaders = true,
  } = opts;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const Limit = await rateLimit(req!.ip as string, limit, windowMs);
      if (Limit.limited) return res.sendStatus(429);
      console.log("checked");
      next();
    } catch (e) {
      console.error("Failed to connect to redis: ", e);
      next();
    }
  };
};
