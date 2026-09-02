import { NextFunction, Request, Response, Router } from "express";
import { renderWithLayout } from "../views/utils";
import ejs from "ejs";
import { getPosts } from "../domain/posts";
import {
  compiledInstanceStatus,
  instanceHasRequesterBlocked,
} from "../domain/instances";
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
    return renderWithLayout(req, res, "pages/signup", res.locals);
  } catch (e) {
    return res.sendStatus(500);
  }
});
router.get("/login", async (req: Request, res: Response) => {
  try {
    res.locals.authAction = "login";
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
      res.locals.status = status;
      if (status.is_visible || req.ctx.elevated) {
        const page = Number(req.query?.p ?? 0);
        console.log(page, "is the page", req.ctx);
        const posts = await getPosts(req.ctx, page);
        for (const post of posts) {
          post.added = new Date(post.added).toUTCString();
          if (
            post.authenticated_user_name?.toLowerCase().replace(/ /g, "") ===
            post.author.toLowerCase()
          )
            post.authentic = true;
          post.creator_blocked = await instanceHasRequesterBlocked(
            req.ctx.instance,
            post.user_identifier ?? "",
            post.ip_hash,
          );
        }
        res.locals.posts = posts;
      }
      console.log(res.locals.posts, "posts");
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

export const pagesRouter = router;
