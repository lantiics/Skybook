import type { RequestContext } from "./context.ts";

declare global {
  namespace Express {
    interface Request {
      ctx: RequestContext;
    }
  }
}

export {};
