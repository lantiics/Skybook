import { Request, Response } from "express";
import { errorStatus } from "../errors";

export const router = require("express").Router();

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
    return res.sendStatus(501);
  } catch (e) {
    return errorStatus(e, req.ctx.elevated);
  }
});
