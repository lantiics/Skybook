require("./startup/inject-secrets.ts");
import cookieParser from "cookie-parser";

import { authenticate } from "./middleware/authenticate.ts";
import { resolveInstance } from "./middleware/resolve-instance.ts";
import express from "express";
const app = express();

const port = 3000;
app.listen(port);
var path = require("path");
const api = express.Router();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
var logger = require("morgan");
app.use(logger("dev"));
app.use(cookieParser(process.env.COOKIE_SIGNING_SECRET));
app.set("view engine", "ejs");
app.set("views", "./src/views");
const createError = require("http-errors");

app.use(express.static(path.join(__dirname, "public")));
// app.use("/admin", express.static(path.join(__dirname, "admin")));
const { router } = require("./routes/kaiju.ts");
const { users } = require("./routes/users");
const { account } = require("./routes/account");
import { pagesRouter } from "./routes/pages";
import { instanceRouter } from "./routes/pages";

app.use("/api", api);

api.use("/auth", users);

api.use("/:instance", resolveInstance, authenticate, router);
console.log("using instance");

app.use("/", authenticate, pagesRouter);
app.use("/:instance", resolveInstance, authenticate, instanceRouter);
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err.status;

  // render the error page
  res.status(err.status || 500);
  // console.log(err)

  res.send({ "res.locals.error": res.locals.message });
});

export default app;
