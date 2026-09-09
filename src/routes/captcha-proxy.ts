const express = require("express");
const router = express.Router();
import { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { errorStatus } from "../errors";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

if (config.captcha.implementation === "cap") {
  router.post(
    `/${config.captcha.site_key}/challenge/`,
    createProxyMiddleware({
      target: config.captcha.challenge_url,
      changeOrigin: true,
      pathRewrite: { "^": "" },
      logger: console,
      on: {
        proxyReq: fixRequestBody,
      },
    }),
  );
}
// router.post(
//   `/${config.cap.site_key}/siteverify`,
//   createProxyMiddleware({
//     target: config.cap.local_url,
//     changeOrigin: true,
//     pathRewrite: { "^/api/captcha": "" },
//     logger: console,
//   }),
// );
// router.post(
//   `/${config.cap.site_key}/redeem`,
//   async (req: Request, res: Response) => {
//     console.log(req.body, "request body!");
//     const success = await (
//       await fetch(`http://127.0.0.1:9000/${config.cap.site_key}/siteverify`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           secret: config.cap.secret_key,
//           response: req.body.token,
//           solutions: req.body.solutions,
//           instr: req.body.instr,
//         }),
//       })
//     ).json();
//     console.log(success, "success!!");
//     if (!success) return res.sendStatus(401);
//     else return res.sendStatus(200);
//   },
// );

export const captchaProxy = router;
