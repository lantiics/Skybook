import { config } from "./config.ts";
require("./startup/inject-secrets.ts");
import cookieParser from "cookie-parser";
import { authenticate } from "./middleware/authenticate.ts";
import { resolveInstance } from "./middleware/resolve-instance.ts";
import express from "express";
require("./jobs/cron.ts")
const VERSION = hash("SHA1", Date.now().toString()).slice(0, 8);
const app = express();
app.locals.assetVersion = VERSION;
app.set("trust proxy", config.skybook.proxies_between);

app.listen(process.env.PORT || 3000);
var path = require("path");
const api = express.Router();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.text());
var logger = require("morgan");
app.use(logger("dev"));
app.use(cookieParser(process.env.COOKIE_SIGNING_SECRET));
app.set("view engine", "ejs");
app.set("views", "./src/views");
const createError = require("http-errors");

app.use(express.static(path.join(__dirname, "public")));
const { router } = require("./routes/skybook.ts");
const { users } = require("./routes/users");
const { account } = require("./routes/account");
import { pagesRouter } from "./routes/pages";
import { instanceRouter } from "./routes/pages";
import vhost from "vhost";
import { captchaProxy } from "./routes/captcha-proxy";
import { hash } from "crypto";

app.use("/api", api);
api.use("/captcha", captchaProxy);
api.use("/account", authenticate, account);
api.use("/auth", users);

api.use("/:instance", resolveInstance, authenticate, router);
console.log("using instance");

const skybook = express.Router();
skybook.use(authenticate, pagesRouter);
if (config.skybook.subdomain_vanity) {
  app.use(vhost(config.skybook.domain, skybook));
} else {
  app.use("/", skybook);
}

if (config.skybook.subdomain_vanity) {
  const instance = express.Router();
  instance.use(resolveInstance, authenticate, instanceRouter);
  app.use(vhost(`*.${config.skybook.domain}`, instance));
} else {
  app.use("/:instance", resolveInstance, authenticate, instanceRouter);
}
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err.status;
  res.locals.title = err.status;
  if (
    err.status === 404
    // (req.host !== config.skybook.domain ||
    //   (req.host === config.skybook.domain && req.path !== "/"))
  ) {
    if (req.host !== config.skybook.domain && req.path == "/") {
      return res.redirect(`http://${config.skybook.domain}`);
    } else {
      return res.redirect(
        `http://${req.ctx.instance}.${config.skybook.domain}`,
      );
    }
  }
  // render the error page
  res.status(err.status || 500);

  res.render("error");
});
export default app;
