import { NextFunction, Request, Response, Router } from "express";
import { renderWithLayout } from "../views/utils";
import { countPosts, getPosts, pageCount } from "../domain/posts";
import {
  compiledInstanceStatus,
  instanceIpBlocks,
  instanceSuppliedFilter,
} from "../domain/instances";
import { getFieldData } from "../domain/fields";
import { config } from "../config";
import { partials } from "./partials.ts";
import { loginEnabled, signupEnabled } from "../domain/service-settings.ts";
const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    res.locals.subdomain_vanity = config.skybook.subdomain_vanity;
    res.locals.domain = config.skybook.domain;
    res.locals.user = req.ctx.user;
    res.locals.authenticated = req.ctx.authenticated;
    return renderWithLayout(req, res, "pages/about", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});
router.get("/features", async (req: Request, res: Response) => {
  try {
    res.locals.subdomain_vanity = config.skybook.subdomain_vanity;
    res.locals.domain = config.skybook.domain;
    res.locals.user = req.ctx.user;
    res.locals.authenticated = req.ctx.authenticated;
    res.locals.title = "Features - Skybook";

    return renderWithLayout(req, res, "pages/features", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});

router.get("/signup", async (req: Request, res: Response) => {
  try {
    res.locals.authAction = "signup";
    res.locals.captcha = config.captcha;
    res.locals.signupEnabled = await signupEnabled();
    res.locals.title = "Sign up - Skybook";
    return renderWithLayout(req, res, "pages/signup", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});
router.get("/login", async (req: Request, res: Response) => {
  try {
    res.locals.authAction = "login";
    res.locals.captcha = config.captcha;
    res.locals.loginEnabled = await loginEnabled();
    res.locals.title = "Log in - Skybook";
    return renderWithLayout(req, res, "pages/login", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});

router.get("/account", async (req: Request, res: Response) => {
  if (!req.ctx.authenticated) {
    return res.redirect("/login");
  }
  try {
    res.locals.title = "My account - Skybook";
    renderWithLayout(req, res, "pages/account", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});
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
      console.log(req.query.p);

      const posts = await getPosts(req.ctx, page);
      if (!posts[0] && page !== 0)
        return res.redirect(`/${req.ctx.instance}?p=${pages}`);
      for (const post of posts) {
        post.added = new Date(post.added).toUTCString();
        if (
          post.authenticated_user_name &&
          post.authenticated_user_name.toLowerCase().replace(/ /g, "") ===
            post.author.toLowerCase()
        )
          post.authentic = true;
        post.creator_blocked = (parseInt(post.block_count) || 0) > 0;
        console.log(post);
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

        console.log(post.extra, "yea");
      }
      res.locals.posts = posts;
    }
    if (req.ctx.elevated) {
      res.locals.blocks = await instanceIpBlocks(req.ctx.instance);
      res.locals.blocks.global = {
        proxy: config.ip_blocking.proxy_addresses_blocked,
        vpn: config.ip_blocking.vpn_addresses_blocked,
        tor: config.ip_blocking.tor_addresses_blocked,
      };
      (res.locals.filter = await instanceSuppliedFilter(req.ctx.instance)) ??
        "";
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
    console.error(e, "error", req.ctx.instance);
    return res.sendStatus(500);
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
    return await instanceLogic(req, res, next, true);
  },
);

router.use("/partials", partials);

export const pagesRouter = router;
