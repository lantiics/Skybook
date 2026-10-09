import { Request, Response, Router } from "express";
import { setupTwoFactor, generateRecoveryCodes } from "../domain/auth";
import { initUserMfa } from "../domain/users";
const router = Router();

router.get("/enable-2fa", async (req: Request, res: Response) => {
  if (!req.ctx.user || req.ctx.user.mfaEnabled) {
    return res.sendStatus(400);
  }
  const totpInfo = await setupTwoFactor(req.ctx.user!.name);
  const [codes, hashedCodes] = generateRecoveryCodes();
  await initUserMfa(req.ctx.user.identifier, totpInfo.secret, hashedCodes);
  res.locals.ctx = req.ctx;
  res.locals.secret = totpInfo.secret;
  res.locals.uri = totpInfo.uri;
  res.locals.qr = totpInfo.qrDataUrl;
  res.locals.codes = codes;
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
export const partials = router;
