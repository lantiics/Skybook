import { config } from "./config.ts";
import { injectSecrets } from "@/startup/inject-secrets";
injectSecrets();
import cookieParser from "cookie-parser";
import { authenticate } from "./middleware/authenticate.ts";
import { resolveInstance } from "./middleware/resolve-instance.ts";
import express, { NextFunction, Request, Response } from "express";
import { runMigrations } from "@startup/migrate";
import createError, { HttpError } from "http-errors";
import path from "path";
await runMigrations();
require("./jobs/cron.ts");
const VERSION = hash("SHA1", Date.now().toString()).slice(0, 8);
const app = express();
app.locals.assetVersion = VERSION;
app.set("trust proxy", config.skybook.proxies_between);

const PORT = process.env.PORT || 3000;
app.listen(PORT);
console.log("Listening on port " + PORT);
const api = express.Router();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.text());
if (process.env.NODE_ENV === "development") {
  const logger = require("morgan");
  app.use(logger("dev"));
}
app.use(cookieParser(process.env.COOKIE_SIGNING_SECRET));
app.set("view engine", "ejs");
app.set("views", "./src/views");

app.use(express.static(path.join(__dirname, "public")));
import { router } from "./routes/skybook.ts";
import { users } from "./routes/users.ts";
import { account } from "./routes/account.ts";
import { pagesRouter } from "./routes/pages.ts";
import { instanceRouter } from "./routes/pages.ts";
import vhost from "vhost";
import { captchaProxy } from "./routes/captcha-proxy.ts";
import { hash } from "crypto";

app.use("/api", api);
api.use("/captcha", captchaProxy);
api.use("/account", authenticate, account);
api.use("/auth", users);

api.use("/:instance", resolveInstance, authenticate, router);

const skybook = express.Router();
skybook.use(authenticate, pagesRouter);
if (config.skybook.subdomain_vanity) {
  app.use(vhost(config.skybook.domain, skybook as any));
} else {
  app.use("/", skybook);
}

if (config.skybook.subdomain_vanity) {
  const instance = express.Router();
  instance.use(resolveInstance, authenticate, instanceRouter);
  app.use(vhost(`*.${config.skybook.domain}`, instance as any));
} else {
  app.use("/:instance", resolveInstance, authenticate, instanceRouter);
}
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.locals.message = err.message;
  res.locals.error = err.status;
  res.locals.title = err.status;
  if (err.status === 404) {
    if (req.host !== config.skybook.domain && req.path == "/") {
      return res.redirect(`${req.protocol}://${config.skybook.domain}`);
    }
  }
  // render the error page
  res.status(err.status || 500);
  res.locals.canonical = `${req.protocol}://${req.hostname}${req.path}`;
  res.locals.protocol = req.protocol;
  res.render("error");
});
export default app;
