import { resolve } from "bun";
import { Request, Response, Router } from "express";
import { setupTwoFactor, generateRecoveryCodes } from "../domain/auth";
const router = Router();

router.get("/enable-2fa", async (req: Request, res: Response) => {
  const totpInfo = await setupTwoFactor(req.ctx.user!.name);
  const recoveryCodes = generateRecoveryCodes();
  res.locals.ctx = req.ctx;
  res.locals.secret = totpInfo.secret;
  res.locals.uri = totpInfo.uri;
  res.locals.qr = totpInfo.qrDataUrl;
  res.locals.codes = recoveryCodes;
  return res.render("partials/account/enable-2fa");
});
router.get("/disable-2fa", async (req: Request, res: Response) => {
  res.locals.ctx = req.ctx;
  return res.render("partials/account/disable-2fa");
});

router.get("/delete-account", async (req: Request, res: Response) => {
  res.locals.ctx = req.ctx;
  return res.render("partials/account/delete-account");
});
// const partials = router
export const partials = router;
