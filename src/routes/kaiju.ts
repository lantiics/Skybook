import { NextFunction, Request, Response } from "express";
import { config } from "../config.ts";
import rateLimit from "express-rate-limit";
import { errorStatus, NotFoundError, UnauthorizedError } from "../errors.ts";
import {
  compiledInstanceStatus,
  toggleInstanceVisibility,
  toggleInstanceApproval,
  toggleInstanceFlagging,
  toggleInstanceReplying,
  toggleInstanceSubmission,
} from "../domain/instances.ts";
import {
  getPosts,
  createPost,
  deletePost,
  editPost,
  flagPost,
  approvePost,
  togglePostHighlight,
  togglePostFlagging,
  togglePostPin,
  togglePostReplying,
  togglePostVisibility,
  clearPostFlags,
  lockPostMethods,
  blockPostCreator,
  unblockPostCreator,
} from "../domain/posts.ts";
import {
  getFieldFilters,
  setFieldFilter,
  setField,
  renameField,
} from "../domain/fields.ts";

//#region HELPERS

const alterationLimiter = rateLimit({
  windowMs: config.rate_limits.alteration_window_ms,
  limit: (req: Request) =>
    !req.ctx.elevated
      ? config.rate_limits.alteration_limit_anonymous
      : config.rate_limits.alteration_limit_elevated,
});
const fetchLimiter = rateLimit({
  windowMs: config.rate_limits.fetch_window_ms,
  limit: config.rate_limits.fetch_limit,
});
const creationLimiter = rateLimit({
  windowMs: config.rate_limits.entry_creation_window_ms,
  limit: 1,
});
//#endregion HELPERS

export const router = require("express").Router();

// START helpers

//#region PUBLIC METHODS
router.get(
  "/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.send(await compiledInstanceStatus(req.ctx.instance));
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);

router.get(
  "/",
  fetchLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.query.p || Math.sign(Number(req.query.p)) === -1) {
      return res.sendStatus(400);
    }
    try {
      const posts = await getPosts(req.ctx, Number(req.query.p));
      return res.send(posts);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);

// raw post alteration
router.post(
  "/",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(req.body, "aa");
      const createdEntry = await createPost(req.ctx, req.body);
      if (createdEntry.token) {
        res.setHeader(`token`, createdEntry.token);
      }

      return res
        .status(createdEntry.wasQueued ? 202 : 201)
        .send(createdEntry.row);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.delete(
  "/entry/:identifier",
  alterationLimiter,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.params.identifier as string;
      await deletePost(req.ctx, req.params.identifier as string);
      return res.sendStatus(204);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.params.identifier as string;
      const entry = await editPost(req.ctx, identifier, req.body);
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);

//
router.post(
  "/entry/:identifier/flag",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await flagPost(req.ctx, req.params.identifier as string);
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
//#endregion PUBLIC METHODS

//#region ELEVATED
router.get(
  "/export",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const exportedInstanceData = "";
      return res.status(200).send("TODO");
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.put(
  "/import",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      //TODO
      //
      //
      //
      // const importResult = dropbox.import(req.body);
      return res.sendStatus(201);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
//#region INSTANCE METHODS
router.patch(
  "/visibility",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceVisibility(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/flagging",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceFlagging(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/submission",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceSubmission(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/replying",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceReplying(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/approval",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceApproval(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.get(
  // return supplied regex filters
  "/filters",
  fetchLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const filters = await getFieldFilters(req.ctx);

      return res.send(filters);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
//#endregion INSTANCE METHODS
//#region FIELDS
router.patch(
  "/field/:field/filters",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const field = await setFieldFilter(
        req.ctx,
        req.params.field as string,
        req.body.filter,
      );
      return res.status(201).send(field);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router
  .route("/field/:field")
  .patch(
    // Rename a field
    alterationLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.ctx.elevated) return res.sendStatus(403);
      try {
        const field = await renameField(
          req.ctx,
          req.body.oldName,
          req.body.newName,
        );

        return res.status(200).send(field);
      } catch (e) {
        return res.sendStatus(errorStatus(e, req.ctx.elevated));
      }
    },
  )
  .put(
    // Create/set a field
    alterationLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.ctx.elevated) return res.sendStatus(403);
      try {
        const field = await setField(req.ctx, req.body);
        return res.status(201).send(field);
      } catch (e) {
        return res.sendStatus(errorStatus(e, req.ctx.elevated));
      }
    },
  )
  .delete(
    alterationLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.ctx.elevated) return res.sendStatus(403);
      try {
        return res.sendStatus(204);
      } catch (e) {
        return res.sendStatus(errorStatus(e, req.ctx.elevated));
      }
    },
  );
//#endregion FIELDS
//#region ENTRIES
router.patch(
  "/entry/:identifier/block",
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await blockPostCreator(req.ctx, req.params.identifier as string);
      return res.sendStatus(201);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/unblock",
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await unblockPostCreator(req.ctx, req.params.identifier as string);
      return res.sendStatus(201);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/replying",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await togglePostReplying(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/approve",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await approvePost(req.ctx, req.params.identifier as string);
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/visibility",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await togglePostVisibility(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/pin",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await togglePostPin(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/highlight",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await togglePostHighlight(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/clear-flags",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await clearPostFlags(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/entry/:identifier/flagging",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const entry = await togglePostFlagging(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
//#endregion ENTRIES
//#endregion ELEVATED

//#region OVERRIDES
router.patch(
  "/entry/:identifier/lock",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.superAdmin) return res.sendStatus(403);
    try {
      const entry = await lockPostMethods(
        req.ctx,
        req.params.identifier as string,
      );
      return res.status(200).send(entry);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);

router.patch("/lock", async (req: Request, res: Response) => {
  if (!req.ctx.superAdmin) return res.sendStatus(403);
  try {
  } catch (e) {}
});
router
  .route("/override/:method")
  .patch(async (req: Request, res: Response) => {
    try {
      if (!req.ctx.superAdmin)
        throw new UnauthorizedError(
          "Insufficient permissions to access system-level endpoint",
        );

      switch (req.params.method as string) {
        case "visibility":
          break;
        case "submission":
          break;
        case "replying":
          break;
        case "approval":
          break;
        case "flagging":
          break;
        case "queue-filtered":
          break;
        default:
          throw new NotFoundError("Requested method is not available");
      }
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.authenticated));
    }
  })
  .delete(async (req: Request, res: Response) => {
    try {
      if (!req.ctx.superAdmin)
        throw new UnauthorizedError(
          "Insufficient permissions to access system-level endpoint",
        );

      switch (req.params.method as string) {
        case "visibility":
          break;
        case "submission":
          break;
        case "replying":
          break;
        case "approval":
          break;
        case "flagging":
          break;
        case "queue-filtered":
          break;
        default:
          throw new NotFoundError("Requested method is not available");
      }
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.authenticated));
    }
  });
//#endregion
