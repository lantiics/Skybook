import { Router, Request, Response } from "express";
import { config } from "../config.ts";
import { limiter } from "../domain/rate-limit.ts";
import {
  changeUserPassword,
  createUser,
  enableUserMfa,
  loginUser,
  userPasswordIsValid,
} from "../domain/users.ts";
import { getSessionUser, revokeSession } from "../domain/sessions.ts";
import {
  BadRequestError,
  errorStatus,
  ForbiddenError,
  UnauthorizedError,
} from "../errors.ts";
import { assertCaptchaTokenValid } from "../domain/captcha.ts";
import { verifyTotp } from "../domain/auth.ts";
import { invitationIsValid, newInvitation } from "../domain/invitations.ts";
import { authenticate } from "../middleware/authenticate.ts";

const router = Router();
export const users = router;
const authLimiter = limiter({
  windowMs: config.rate_limits.auth_window_ms,
  limit: config.rate_limits.auth_limit,
});

router.post("/signup", authLimiter, async (req: Request, res: Response) => {
  try {
    await assertCaptchaTokenValid(req.body[config.captcha.token_property_name]);
    if (!req.ip) {
      throw new ForbiddenError("");
    }
    if (config.skybook.invitation_required) {
      if (!req.body.invitation)
        throw new UnauthorizedError("No invitation provided");
      if (!(await invitationIsValid(req.body.invitation)))
        throw new UnauthorizedError("Provided invitation token is invalid");
    }
    req.body.username = req.body.username.toLowerCase();

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
      domain: config.skybook.domain,
    });
    return res
      .status(201)
      .setHeader(
        "goto",
        config.skybook.subdomain_vanity
          ? `http://${req.body.username}.${config.skybook.domain}`
          : `/${req.body.username}`,
      )
      .send();
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
    req.body.username = req.body.username.toLowerCase();
    const sessionKey = await loginUser(
      req.body.username,
      req.body.password,
      req.body.otp ?? undefined,
    );
    console.log("");
    res.cookie("session", sessionKey, {
      signed: true,
      httpOnly: true,
      secure: config.is_production,
      sameSite: "strict",
      domain: config.skybook.domain,
    });
    console.timeEnd("Logged in");
    return res
      .status(200)
      .setHeader(
        "goto",
        config.skybook.subdomain_vanity
          ? `http://${req.body.username}.${config.skybook.domain}`
          : `/${req.body.username}`,
      )
      .send();
  } catch (e) {
    console.error(e, "error!");
    return res.sendStatus(errorStatus(e, false));
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const sessionKey = req.signedCookies.session;
  if (!sessionKey) {
    return res.sendStatus(400);
  }
  console.log(sessionKey);
  await revokeSession(sessionKey);
  res.clearCookie("session", {
    domain: config.skybook.domain,
  });
  return res.sendStatus(200);
});

router.post("/password", async (req: Request, res: Response) => {
  try {
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
    const { oldPassword, newPassword, otp } = req.body;

    await changeUserPassword(userIdentifier, oldPassword, newPassword, otp);
    res.clearCookie("session");
    const encodedPopupText = btoa("Password changed");
    return res.redirect("/login#pup:" + encodedPopupText);
  } catch (e) {
    const encodedPopupText = btoa("Failed to change password");
    return res.redirect("/account#pup:" + encodedPopupText);
    return res.sendStatus(errorStatus(e, false));
  }
});
router.post(
  "/invitation",
  authenticate,
  authLimiter,
  async (req: Request, res: Response) => {
    try {
      const invitation = await newInvitation(req.ctx.user!.identifier);
      return res.status(201).send(invitation);
    } catch (e) {
      return res.sendStatus(errorStatus(e, false));
    }
  },
);
