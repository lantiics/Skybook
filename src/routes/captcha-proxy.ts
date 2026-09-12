const express = require("express");
const router = express.Router();
import { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { errorStatus } from "../errors";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

if (config.captcha.implementation === "cap") {
  router.post(
    `/${config.captcha.site_key}/:s`,
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

export const captchaProxy = router;
