import { Request, Response, Router } from "express";
import { setupTwoFactor, generateRecoveryCodes } from "../domain/auth";
import { initUserMfa } from "../domain/users";
const router = Router();

router.get("/enable-2fa", async (req: Request, res: Response) => {
  if (!req.ctx.user || req.ctx.user.mfaEnabled) {
    return res.sendStatus(400);
  }
  const { secret, uri, qrDataUrl, codes, hashedCodes } = await setupTwoFactor(
    req.ctx.user!.name,
  );
  await initUserMfa(req.ctx.user.identifier, secret, hashedCodes);

  res.locals.ctx = req.ctx;
  res.locals.secret = secret;
  res.locals.uri = uri;
  res.locals.qr = qrDataUrl;
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
