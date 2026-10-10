import { Request, Response, Router } from "express";
import { setupTwoFactor } from "../domain/auth";
import { initUserMfa, regenerateRecoveryCodes } from "../domain/users";
import { errorStatus } from "../errors";
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

// regenerate MFA recovery codes
router.get("/regen-recovery-gate", async (req: Request, res: Response) => {
  if (!req.ctx.user || !req.ctx.user.mfaEnabled) return res.sendStatus(403);
  res.locals.ctx = req.ctx;
  return res.render("partials/account/regen-recovery-gate");
});

router.post("/new-recovery-codes", async (req: Request, res: Response) => {
  try {
    if (!req.ctx.user) return res.sendStatus(401);
    console.log(req.ctx.user);
    const codes = await regenerateRecoveryCodes(
      req.ctx.user.identifier,
      req.body.password,
    );
    res.locals.codes = codes;
    return res.render("partials/account/regen-recov-codes");
  } catch (e) {
    return res.sendStatus(errorStatus(e, false));
  }
});

router.get("/delete-account", async (req: Request, res: Response) => {
  res.locals.ctx = req.ctx;
  return res.render("partials/account/delete-account");
});
export const partials = router;
