import { NextFunction, Request, Response } from "express";
import { config } from "../config.ts";
import { limiter } from "../domain/rate-limit.ts";
import { errorStatus, NotFoundError, UnauthorizedError } from "../errors.ts";
import {
  compiledInstanceStatus,
  toggleInstanceVisibility,
  toggleInstanceApproval,
  toggleInstanceFlagging,
  toggleInstanceSubmission,
  toggleInstanceTorBlacklist,
  toggleInstanceVPNBlacklist,
  toggleInstanceProxyBlacklist,
  toggleInstanceQueueOnFiltered,
  updateInstanceSuppliedFilter,
  exportInstance,
  importInstance,
  updateInstanceQueueFlaggedThreshold,
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
  togglePostVisibility,
  clearPostFlags,
  lockPostMethods,
  blockPostCreator,
  unblockPostCreator,
  replyToPost,
} from "../domain/posts.ts";
import {
  getFieldFilters,
  setFieldFilter,
  setField,
  renameField,
  deleteField,
} from "../domain/fields.ts";
const multer = require("multer");
const { Readable } = require("stream");
import { assertCaptchaTokenValid } from "../domain/captcha.ts";
import csvParser from "csv-parser";
import { Post } from "../types/entities";
const path = require("path");
const os = require("os");
const fs = require("node:fs");

//#region HELPERS

const alterationLimiter = limiter({
  windowMs: config.rate_limits.alteration_window_ms,
  limit: config.rate_limits.alteration_limit_anonymous,
});
const fetchLimiter = limiter({
  windowMs: config.rate_limits.fetch_window_ms,
  limit: config.rate_limits.fetch_limit,
});
const creationLimiter = limiter({
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
      await assertCaptchaTokenValid(
        req.body[config.captcha.token_property_name],
      );
      delete req.body[config.captcha.token_property_name];
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
      if (e instanceof Bun.SQL.PostgresError) return res.sendStatus(409);
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
//#endregion PUBLIC METHODS

//#region ELEVATED
router.put(
  `/entry/:identifier/reply`,
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await replyToPost(
        req.ctx,
        req.params.identifier as string,
        req.body.content,
      );
      return res.sendStatus(201);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.get(
  "/export",
  alterationLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const exportedData = await exportInstance(req.ctx);
      res.set(
        "Content-Disposition",
        `attachment; filename="${req.ctx.instance}-export.csv"`,
      );
      return res.status(200).send(exportedData);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.post(
  "/import",
  alterationLimiter,
  multer({ storage: multer.memoryStorage() }).single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      const r: Post[] = [];
      //@ts-expect-error
      const stream = Readable.from([req.file.buffer]);
      const response = await stream
        .pipe(csvParser())

        .on("data", (data: Post) => r.push(data))
        .on("end", async () => {
          const importResult = await importInstance(req.ctx.instance, r);
          return importResult;
        });

      return res.sendStatus(201);
    } catch (e) {
      return res
        .status(errorStatus(e, req.ctx.elevated))
        .redirect(
          (res.getHeader("referer") ?? config.skybook.subdomain_vanity)
            ? "/"
            : `/${req.ctx.instance}`,
        );
    }
  },
);
//#region BLOCKLISTS
router.patch(
  "/proxy",
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceProxyBlacklist(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch("/vpn", alterationLimiter, async (req: Request, res: Response) => {
  if (!req.ctx.elevated) return res.sendStatus(403);
  try {
    await toggleInstanceVPNBlacklist(req.ctx.instance);
    return res.sendStatus(200);
  } catch (e) {
    return res.sendStatus(errorStatus(e, req.ctx.elevated));
  }
});
router.patch("/tor", alterationLimiter, async (req: Request, res: Response) => {
  if (!req.ctx.elevated) return res.sendStatus(403);
  try {
    await toggleInstanceTorBlacklist(req.ctx.instance);
    return res.sendStatus(200);
  } catch (e) {
    return res.sendStatus(errorStatus(e, req.ctx.elevated));
  }
});
//#endregion
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
router.patch(
  "/queue-filtered",
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await toggleInstanceQueueOnFiltered(req.ctx.instance);
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.patch(
  "/queue-threshold",
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await updateInstanceQueueFlaggedThreshold(
        req.ctx.instance,
        req.body.threshold,
      );
      return res.sendStatus(200);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
// Update the instance's supplied filter.
// Instance owners can supply their own filters which apply to every field.
router.patch(
  "/filter",
  alterationLimiter,
  async (req: Request, res: Response) => {
    if (!req.ctx.elevated) return res.sendStatus(403);
    try {
      await updateInstanceSuppliedFilter(req.ctx.instance, req.body.filter);
      return res.sendStatus(200);
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
        req.body.name = req.params.field;
        const field = await setField(req.ctx.instance, req.body);
        console.log(field, "mhm");
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
        await deleteField(req.ctx.instance, req.params.field as string);
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
      console.log(req.body, "reason");
      await blockPostCreator(
        req.ctx,
        req.params.identifier as string,
        req.body !== "" ? req.body : undefined,
      );
      return res.sendStatus(201);
    } catch (e) {
      return res.sendStatus(errorStatus(e, req.ctx.elevated));
    }
  },
);
router.delete(
  "/entry/:identifier/block",
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
// router.patch(
//   "/entry/:identifier/lock",
//   alterationLimiter,
//   async (req: Request, res: Response, next: NextFunction) => {
//     if (!req.ctx.superAdmin) return res.sendStatus(403);
//     try {
//       const entry = await lockPostMethods(
//         req.ctx,
//         req.params.identifier as string,
//       );
//       return res.status(200).send(entry);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, req.ctx.elevated));
//     }
//   },
// );

// router.patch("/lock", async (req: Request, res: Response) => {
//   if (!req.ctx.superAdmin) return res.sendStatus(403);
//   try {
//     await
//   } catch (e) {}
// });
// router
//   .route("/override/:method")
//   .patch(async (req: Request, res: Response) => {
//     try {
//       if (!req.ctx.superAdmin)
//         throw new UnauthorizedError(
//           "Insufficient permissions to access system-level endpoint",
//         );

//       switch (req.params.method as string) {
//         case "visibility":
//           break;
//         case "submission":
//           break;
//         case "replying":
//           break;
//         case "approval":
//           break;
//         case "flagging":
//           break;
//         case "queue-filtered":
//           break;
//         default:
//           throw new NotFoundError("Requested method is not available");
//       }
//       return res.sendStatus(200);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, req.ctx.authenticated));
//     }
//   })
//   .delete(async (req: Request, res: Response) => {
//     try {
//       if (!req.ctx.superAdmin)
//         throw new UnauthorizedError(
//           "Insufficient permissions to access system-level endpoint",
//         );

//       switch (req.params.method as string) {
//         case "visibility":
//           break;
//         case "submission":
//           break;
//         case "replying":
//           break;
//         case "approval":
//           break;
//         case "flagging":
//           break;
//         case "queue-filtered":
//           break;
//         default:
//           throw new NotFoundError("Requested method is not available");
//       }
//       return res.sendStatus(200);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, req.ctx.authenticated));
//     }
//   });
//#endregion
