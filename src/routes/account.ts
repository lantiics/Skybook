import { Request, Response } from "express";
import { BadRequestError, errorStatus, UnauthorizedError } from "../errors";
import {
  deleteUser,
  disableUserMfa,
  enableUserMfa,
  userPasswordIsValid,
} from "../domain/users";
import { verifyTotp } from "../domain/auth";

const router = require("express").Router();

//
//
//
//
//
//
//
//
router.delete("/", async (req: Request, res: Response) => {
  try {
    await deleteUser(req.ctx, req.ctx.user?.identifier as string);
    return res.sendStatus(204);
  } catch (e) {
    console.error(e);
    return errorStatus(e, req.ctx.elevated);
  }
});

router.post("/enable-totp", async (req: Request, res: Response) => {
  try {
    const { secret, otp, password, codes } = req.body;

    if (!secret || !otp || !password || !codes)
      throw new BadRequestError("Required credentials not supplied");
    if (!userPasswordIsValid) throw new UnauthorizedError("Password incorrect");
    if (!(await verifyTotp(secret, otp)))
      throw new UnauthorizedError("Incorrect one time password supplied");
    console.log(req.ctx);
    await enableUserMfa(
      req.ctx.user!.identifier,
      secret,
      JSON.parse(atob(codes)),
    );
    return res.status(201).redirect("/login");
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return res
        .status(401)
        .redirect("/account#pup:" + btoa("Provided OTP code is invalid"));
    return res.sendStatus(errorStatus(e, false));
  }
});
router.post("/verify-totp", async (req: Request, res: Response) => {
  try {
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});

router.post("/disable-totp", async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password)
      throw new UnauthorizedError("Required credentials not provided");
    if (!userPasswordIsValid(req.ctx.user!.identifier, password))
      throw new UnauthorizedError("Provided credentials are not valid");
    await disableUserMfa(req.ctx.user!.identifier);
    return res.status(204).redirect("/account#pup:" + btoa("2FA Disabled"));
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});

export const account = router;
