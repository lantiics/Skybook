import { NextFunction, Request, Response } from "express";
import { instanceExists } from "../domain/instances";

export const resolveInstance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.time("Resolved instance");
  let instance: string | undefined =
    (req.params.instance as string) ??
    (req.query.instance as string) ??
    req.hostname.split(".")[0] ??
    undefined;
  if (typeof instance !== "undefined") {
    if (!(await instanceExists(instance))) {
      instance = undefined;
    }
  }
  if (instance) {
    req.ctx = { ...req.ctx, instance: instance };
  }
  console.timeEnd("Resolved instance");

  next();
};
