import { Request, Response } from "express";
import {
  BadRequestError,
  errorStatus,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";
import {
  deleteUser,
  disableUserMfa,
  enableUserMfa,
  userPasswordIsValid,
  userTotpData,
} from "../domain/users";
import { verifyTotp } from "../domain/auth";
import { decryptedSecret } from "../domain/encryption";
import { config } from "../config";

const router = require("express").Router();
router.post("/delete", async (req: Request, res: Response) => {
  try {
    if (!req.ctx.authenticated)
      throw new UnauthorizedError(
        "A logged in session is required while attempting account deletion",
      );
    const { password } = req.body;
    if (!password)
      throw new BadRequestError("Required credentials not specified");
    if (!(await userPasswordIsValid(req.ctx.user!.identifier, password)))
      throw new UnauthorizedError("Provided password is incorrect");
    await deleteUser(req.ctx.user!.identifier);
    res.clearCookie("session", {
      domain: config.skybook.domain,
    });
    return res.sendStatus(202);
  } catch (e) {
    if (e instanceof UnauthorizedError && req.ctx.authenticated)
      return res
        .status(401)
        .redirect(
          "/account#pup:" +
            btoa(
              "Failed to delete account: Provided credentials are incorrect",
            ),
        );
    return res.sendStatus(errorStatus(e, req.ctx.elevated));
  }
});

router.post("/enable-totp", async (req: Request, res: Response) => {
  try {
    if (!req.ctx.authenticated || !req.ctx.user) {
      throw new ForbiddenError(
        "Attempted to enable TOTP as an unauthenticated user",
      );
    }
    if (!process.env.TOTP_SECRET_KEY)
      throw new Error("TOTP secret key unavailable, unable to enable TOTP");
    const { otp, password } = req.body;
    if (!otp || !password)
      throw new BadRequestError("Required credentials not supplied");
    if (!(await userPasswordIsValid(req.ctx.user.identifier, password)))
      throw new UnauthorizedError("Password incorrect");
    if (
      !(await verifyTotp(
        decryptedSecret(
          (await userTotpData(req.ctx.user.identifier)).secret,
          req.ctx.user.identifier,
          process.env.TOTP_SECRET_KEY,
        ),
        otp,
      ))
    )
      throw new UnauthorizedError("Incorrect one time password supplied");
    await enableUserMfa(req.ctx.user!.identifier);
    res.clearCookie("session", {
      domain: config.skybook.domain,
    });
    return res.status(201).redirect("/login");
  } catch (e) {
    if (e instanceof UnauthorizedError && req.ctx.authenticated)
      return res
        .status(401)
        .redirect("/account#pup:" + btoa("Provided OTP code is invalid"));
    return res.sendStatus(errorStatus(e, false));
  }
});

router.post("/disable-totp", async (req: Request, res: Response) => {
  try {
    if (!req.ctx.authenticated) {
      throw new UnauthorizedError(
        "A logged in session is required to disable TOTP",
      );
    }
    const { password } = req.body;
    if (!password)
      throw new UnauthorizedError("Required credentials not provided");
    if (!(await userPasswordIsValid(req.ctx.user!.identifier, password)))
      throw new UnauthorizedError("Provided credentials are not valid");
    await disableUserMfa(req.ctx.user!.identifier);
    return res.status(204).redirect("/account#pup:" + btoa("2FA Disabled"));
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});

export const account = router;
