import { NextFunction, Request, Response } from "express";
import { authenticateUser } from "../domain/users";
import { UnauthorizedError } from "../errors";
import { config } from "../config";
import { ipSource } from "../domain/ip";
const assertIpIsBlocked = async (ip: string): Promise<void> => {
  if (
    config.ip_blocking.proxy_addresses_blocked ||
    config.ip_blocking.vpn_addresses_blocked ||
    config.ip_blocking.tor_addresses_blocked
  ) {
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
  }
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
      if (!(e instanceof UnauthorizedError)) {
        console.error(
          "An error occurred during middleware authentication " + e,
        );
        throw e;
      }
    }
  }

  req.ctx = {
    ...req.ctx,
    user: user,
    authenticated: !!user,
    ip: req.ip!,
  };
  res.locals.skybook = config.skybook;

  let elevated = false;
  if (!elevated && user && req.ctx.instance && user.name === req.ctx.instance) {
    elevated = true;
  }

  req.ctx = {
    ...req.ctx,
    elevated,
    token: token,
    identifier: req.params.identifier as string,
  };

  next();
};
