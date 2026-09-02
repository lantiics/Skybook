import { NextFunction, Request, Response } from "express";
import { instanceExists } from "../domain/instances";

export const resolveInstance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.time("Resolved instance");
  let instance =
    (req.params.instance as string) ??
    (req.query.instance as string) ??
    undefined;
  if (typeof instance !== "undefined") {
    if (!(await instanceExists(instance))) {
      instance = undefined;
    }
  }
  req.ctx = {
    instance,
  };
  console.timeEnd("Resolved instance");

  next();
};
