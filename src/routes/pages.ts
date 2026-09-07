import { NextFunction, Request, Response, Router } from "express";
import { renderWithLayout } from "../views/utils";
import ejs from "ejs";
import { countPosts, getPosts } from "../domain/posts";
import {
  compiledInstanceStatus,
  instanceEnabledDefaultFilters,
  instanceHasRequesterBlocked,
  instanceIpBlocks,
  instanceSuppliedFilter,
} from "../domain/instances";
import { getFieldData } from "../domain/fields";
import { config } from "../config";
import { partials } from "./partials.ts";
const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    res.locals.user = req.ctx.user;
    res.locals.authenticated = req.ctx.authenticated;
    return renderWithLayout(req, res, "pages/about", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});

router.get("/signup", async (req: Request, res: Response) => {
  try {
    res.locals.authAction = "signup";
    res.locals.captcha = config.captcha;
    return renderWithLayout(req, res, "pages/signup", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});
router.get("/login", async (req: Request, res: Response) => {
  try {
    res.locals.authAction = "login";
    res.locals.captcha = config.captcha;
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
    renderWithLayout(req, res, "pages/account", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});

export const instanceRouter = Router();
instanceRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.instance) return next();
    try {
      const status = await compiledInstanceStatus(req.ctx.instance);
      let page;
      page = Number(req.query?.p ?? 0);
      if (page === undefined) page = 0;
      console.log(page);
      if (Math.sign(page) === -1) return res.redirect(`/${req.ctx.instance}`);
      res.locals.status = status;
      if (status.is_visible.status || req.ctx.elevated) {
        console.log(req.query.p);

        const posts = await getPosts(req.ctx, page);
        if (!posts[0] && page !== 0)
          return res.redirect(
            `/${req.ctx.instance}?p=${Math.floor((await countPosts(req.ctx)) / 15)}`,
          );
        for (const post of posts) {
          post.added = new Date(post.added).toUTCString();
          if (
            post.authenticated_user_name &&
            post.authenticated_user_name.toLowerCase().replace(/ /g, "") ===
              post.author.toLowerCase()
          )
            post.authentic = true;
          post.creator_blocked = await instanceHasRequesterBlocked(
            req.ctx.instance,

            post.ip_hash,
            post.user_identifier ?? "",
          );
          if (post.authenticated_user_identifier === req.ctx.user?.identifier) {
            post.postedByRequestor = true;
          } else {
            post.postedByRequestor = false;
          }
          if (post.extra == "{}" || !post.extra) {
            post.extra = [];
          }
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
        (res.locals.globalFilter = await instanceSuppliedFilter(
          req.ctx.instance,
        )) ?? "";
        res.locals.filter = await instanceEnabledDefaultFilters(
          req.ctx.instance,
        );
        res.locals.filter.global = config.filter;
      }

      res.locals.fields = await getFieldData(req.ctx.instance);
      if (!res.locals.fields.author) {
      }
      if (!res.locals.fields.content) {
        res.locals.fields.content = { is_required: true };
      }
      res.locals.captcha = config.captcha;
      res.locals.page = page;
      return renderWithLayout(req, res, "pages/instance", res.locals);
    } catch (e) {
      console.error(e, "error", req.ctx.instance);
      return res.sendStatus(500);
    }
  },
);

instanceRouter.get("/elevated", async (req: Request, res: Response) => {
  try {
  } catch (e) {
    return res.sendStatus(500);
  }
});

router.use("/partials", partials);

export const pagesRouter = router;
