import { NextFunction, Request, Response, Router } from "express";
import { renderWithLayout } from "../views/utils";
import { getPosts, pageCount } from "../domain/posts";
import {
  compiledInstanceStatus,
  instanceIpBlocks,
  instanceNotificationInfo,
  instanceSuppliedFilter,
} from "../domain/instances";
import { getFieldData } from "../domain/fields";
import { config } from "../config";
import { partials } from "./partials.ts";
import {
  loginEnabled,
  signupEnabled,
  signupInvitationRequired,
} from "../domain/service-settings.ts";
import { decryptedSecret } from "../domain/encryption.ts";
import { errorStatus } from "../errors.ts";
import "http-errors";
import createHttpError from "http-errors";
const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.locals.subdomain_vanity = config.skybook.subdomain_vanity;
    res.locals.domain = config.skybook.domain;
    res.locals.user = req.ctx.user;
    res.locals.authenticated = req.ctx.authenticated;
    return renderWithLayout(req, res, "pages/about", res.locals);
  } catch (e) {
    next(createHttpError(errorStatus(e, false)));
  }
});
router.get(
  "/privacy",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return renderWithLayout(req, res, "pages/privacy", res.locals);
    } catch (e) {
      next(createHttpError(errorStatus(e, false)));
    }
  },
);

router.get(
  "/features",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.subdomain_vanity = config.skybook.subdomain_vanity;
      res.locals.domain = config.skybook.domain;
      res.locals.user = req.ctx.user;
      res.locals.authenticated = req.ctx.authenticated;
      res.locals.title = "Features - Skybook";
      res.locals.instances = config.instances;

      return renderWithLayout(req, res, "pages/features", res.locals);
    } catch (e) {
      next(createHttpError(errorStatus(e, false)));
    }
  },
);

router.get(
  "/signup",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.authAction = "signup";
      res.locals.captcha = config.captcha;
      res.locals.signupEnabled = await signupEnabled();
      res.locals.signupInvitationRequired = await signupInvitationRequired();
      res.locals.title = "Sign up - Skybook";
      res.setHeader("Cache-Tag", "skybook-signup");
      return renderWithLayout(req, res, "pages/signup", res.locals);
    } catch (e) {
      next(createHttpError(errorStatus(e, false)));
    }
  },
);
router.get(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.authAction = "login";
      res.locals.captcha = config.captcha;
      res.locals.loginEnabled = await loginEnabled();
      res.locals.title = "Log in - Skybook";
      res.setHeader("Cache-Tag", "skybook-login");
      return renderWithLayout(req, res, "pages/login", res.locals);
    } catch (e) {
      next(createHttpError(errorStatus(e, false)));
    }
  },
);

router.get(
  "/account",
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.authenticated) {
      return res.redirect("/login");
    }
    try {
      res.locals.skybook = {
        signupRequiresInvitation: await signupInvitationRequired(),
      };
      res.locals.title = "My account - Skybook";
      res.locals.invitations = config.invitations;
      renderWithLayout(req, res, "pages/account", res.locals);
    } catch (e) {
      next(createHttpError(errorStatus(e, false)));
    }
  },
);
const instanceLogic = async (
  req: Request,
  res: Response,
  next: NextFunction,
  embed: boolean = false,
) => {
  if (!req.ctx.instance) return next();
  try {
    let page;
    page = Number(req.query?.p ?? 0);
    if (page === undefined) page = 0;
    const pages = await pageCount(req.ctx);
    res.locals.pages = pages;
    if (Math.sign(page) === -1) return res.redirect(`/${req.ctx.instance}`);
    const status = await compiledInstanceStatus(req.ctx.instance);
    res.locals.status = status;
    if (status.is_visible.status || req.ctx.elevated) {
      const posts = await getPosts(req.ctx, page, false);
      if (!posts[0] && page !== 0)
        return res.redirect(`/${req.ctx.instance}?p=${pages}`);
      for (const post of posts) {
        post.added = new Date(post.added).toUTCString();
        post.creator_blocked = (parseInt(post.block_count) || 0) > 0;
        if (post.authenticated_user_identifier === req.ctx.user?.identifier) {
          post.postedByRequestor = true;
        } else {
          post.postedByRequestor = false;
        }
        if (post.extra == "{}" || !post.extra) {
          post.extra = [];
        } else {
          post.extra = Object.entries(post.extra);
        }
      }
      res.locals.posts = posts;
    }
    if (req.ctx.elevated) {
      res.locals.instances = config.instances;
      res.locals.blocks = await instanceIpBlocks(req.ctx.instance);
      res.locals.blocks.global = {
        proxy: config.ip_blocking.proxy_addresses_blocked,
        vpn: config.ip_blocking.vpn_addresses_blocked,
        tor: config.ip_blocking.tor_addresses_blocked,
      };
      (res.locals.filter = await instanceSuppliedFilter(req.ctx.instance)) ??
        "";
      const notificationInfo = await instanceNotificationInfo(req.ctx.instance);
      res.locals.notifications = {
        enabled: typeof notificationInfo.notification_endpoint == "string",
        service: notificationInfo.notification_service,
        url:
          typeof notificationInfo.notification_endpoint == "string" &&
          process.env.NOTIFICATION_URL_KEY
            ? decryptedSecret(
                notificationInfo.notification_endpoint,
                req.ctx.instance,
                process.env.NOTIFICATION_URL_KEY,
              )
            : typeof notificationInfo.notification_endpoint == "string"
              ? "Unable to decrypt URL"
              : null,
      };
      res.setHeader("Cache-Control", "private");
    }

    res.locals.fields = await getFieldData(req.ctx.instance);
    if (!res.locals.fields.author) {
    }
    if (!res.locals.fields.content) {
      res.locals.fields.content = { is_required: true };
    }
    res.locals.captcha = config.captcha;
    res.locals.page = page;
    res.locals.ctx = req.ctx;

    res.locals.title = `${req.ctx.instance}'s guestbook - Skybook`;
    res.setHeader("Cache-Tag", `instance-${req.ctx.instance}`);
    if (!embed) {
      return renderWithLayout(req, res, "pages/instance", res.locals);
    } else {
      return res.render("embeds/instance");
    }
  } catch (e) {
    next(createHttpError(errorStatus(e, false)));
  }
};
export const instanceRouter = Router();
instanceRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    return await instanceLogic(req, res, next, false);
  },
);
instanceRouter.get(
  "/embed",
  async (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", "frame-ancestors *;");
    res.locals.canonical = `${req.protocol}://${req.ctx.instance}.${config.skybook.domain}`;
    res.locals.protocol = req.protocol;
    return await instanceLogic(req, res, next, true);
  },
);

router.use("/partials", partials);

export const pagesRouter = router;
