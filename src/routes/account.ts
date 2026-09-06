import { Request, Response } from "express";
import { errorStatus } from "../errors";
import { deleteUser } from "../domain/users";

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

export const account = router;
