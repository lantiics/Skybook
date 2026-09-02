import { NextFunction, Request } from "express";
import { authenticateUser, userIsSuperAdmin } from "../domain/users";
import { NotFoundError, UnauthorizedError } from "../errors";
import { instanceExists } from "../domain/instances";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.time("Authenticated");
  const token = req.headers?.authorization?.split(" ")[1];
  let user;
  if (req.signedCookies.session) {
    try {
      const authenticatedUser = await authenticateUser(
        req.signedCookies.session,
      );
      user = authenticatedUser;
    } catch (e) {
      if (e instanceof UnauthorizedError) {
      } else {
        console.error(e); // during development
      }
    }
  }
  req.ctx = {
    ...req.ctx,
    user: user,
    superAdmin: user?.superAdmin ?? false,
    authenticated: !!user,
    ip: req.ip!,
  };

  if (!req.ctx?.instance) {
    return next();
  }
  let elevated = user?.superAdmin ?? false;
  if (!elevated && user && user.name === req.ctx?.instance) {
    elevated = true;
  }
  // req.ctx = {
  //   instance:
  //     (req.params.instance as string) ?? (req.query.instance as string) ?? null,
  //   elevated: false,
  //   superAdmin: false,
  //   identifier: (req.params?.identifier as string | undefined) ?? undefined,
  //   token: undefined,
  //   authenticated: false,
  //   ip: req.ip!,
  // };

  req.ctx = {
    ...req.ctx,
    elevated,
    token: token,
    identifier: req.params.identifier as string,
  };

  console.log(req.ctx);
  console.timeEnd("Authenticated");

  next();
};
