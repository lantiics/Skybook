import { Router, Request, Response } from "express";
import { config } from "../config.ts";
import rateLimit from "express-rate-limit";
import { changeUserPassword, createUser, loginUser } from "../domain/users.ts";
import { getSessionUser, revokeSession } from "../domain/sessions.ts";
import { errorStatus, ForbiddenError, UnauthorizedError } from "../errors.ts";
import { assertCaptchaTokenValid } from "../domain/captcha.ts";

const router = Router();
export const users = router;
const authLimiter = rateLimit({
  windowMs: config.rate_limits.auth_window_ms,
  limit: 333, //config.rate_limits.auth_limit,
});

router.post("/signup", authLimiter, async (req: Request, res: Response) => {
  try {
    await assertCaptchaTokenValid(req.body[config.captcha.token_property_name]);
    if (!req.ip) {
      throw new ForbiddenError("");
    }
    console.log(req);
    const sessionKey = await createUser(
      req.body.username,
      req.body.password,
      req.ip,
    );
    res.cookie("session", sessionKey, {
      signed: true,
      httpOnly: true,
      secure: config.is_production,
      sameSite: "strict",
    });
    return res.status(201).setHeader("goto", `/${req.body.username}`).send();
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  if (req.signedCookies.session) {
    return res.sendStatus(401);
  }
  try {
    await assertCaptchaTokenValid(req.body[config.captcha.token_property_name]);
    console.time("Logged in");
    const sessionKey = await loginUser(
      req.body.username,
      req.body.password,
      req.body.otp ?? undefined,
    );
    res.cookie("session", sessionKey, {
      signed: true,
      httpOnly: true,
      secure: config.is_production,
      sameSite: "strict",
    });
    console.timeEnd("Logged in");
    return res.status(200).setHeader("goto", `/${req.body.username}`).send();
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const sessionKey = req.signedCookies.session;
  if (!sessionKey) {
    return res.sendStatus(200);
  }
  await revokeSession(sessionKey);
  res.clearCookie("session");
  return res.sendStatus(200);
});

router.post("/password", async (req: Request, res: Response) => {
  try {
    await assertCaptchaTokenValid(
      req.body[config.server.captcha_token_property_name],
    );
    const sessionKey = req.signedCookies.session;
    if (!sessionKey) {
      return res.sendStatus(401);
    }
    const userIdentifier = (await getSessionUser(sessionKey))?.identifier;
    if (!userIdentifier) {
      throw new UnauthorizedError(
        "Provided session key is not linked to a user",
      );
    }
    console.log(req.body);
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    const otp = req.body.otp ?? null;
    await changeUserPassword(userIdentifier, oldPassword, newPassword, otp);
    res.clearCookie("session");
    return res.sendStatus(200);
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});
