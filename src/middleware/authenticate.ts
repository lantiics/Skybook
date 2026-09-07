import { NextFunction, Request } from "express";
import { authenticateUser, userIsSuperAdmin } from "../domain/users";
import { NotFoundError, UnauthorizedError } from "../errors";
import { instanceExists } from "../domain/instances";
import { config } from "../config";
import { ipSource } from "../domain/ip";
const assertIpIsBlocked = async (ip: string) => {
  const source = await ipSource(ip);
  if (config.ip_blocking.proxy_addresses_blocked && source === "proxy")
    throw new UnauthorizedError(
      "This instance prevents access from proxy addresses",
    );
  if (config.ip_blocking.vpn_addresses_blocked && source === "vpn")
    throw new UnauthorizedError(
      "This instance prevents access from VPN addresses",
    );
  if (config.ip_blocking.tor_addresses_blocked && source === "tor")
    throw new UnauthorizedError(
      "This instance prevents access from Tor addresses",
    );
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.time("Authenticated");
  if (
    config.ip_blocking.proxy_addresses_blocked ||
    config.ip_blocking.vpn_addresses_blocked ||
    config.ip_blocking.tor_addresses_blocked
  ) {
    await assertIpIsBlocked(req.ip as string);
  }
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

  req.ctx = {
    ...req.ctx,
    elevated,
    token: token,
    identifier: req.params.identifier as string,
  };

  console.timeEnd("Authenticated");

  next();
};
