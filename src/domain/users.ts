import {
  BadRequestError,
  ForbiddenError,
  LockedError,
  NotFoundError,
  ReservedError,
  UnauthorizedError,
  UnavailableError,
} from "../errors.ts";

import { RequestContext } from "../types/context.ts";
import {
  revokeAllSessions,
  createSession,
  getSessionUser,
} from "./sessions.ts";
import {
  signupEnabled,
  loginEnabled,
  signupInvitationRequired,
} from "./service-settings.ts";
import { READER, WRITER } from "../db.ts";
import { User } from "../types/entities";
import { passwordIsSafe, verifyTotp } from "./auth.ts";
import { config } from "../config.ts";
import { hashIp } from "./ip.ts";
import { generateToken } from "./tokens.ts";
import { userInformation } from "./enforcements.ts";
import { randomBytes } from "node:crypto";
import cookieParser from "cookie-parser";
import { text } from "express";
import { invitationIsValid } from "./invitations.ts";

export const userUUID = async (name: string) => {
  const [user] =
    await READER`SELECT identifier FROM users WHERE name = ${name}`;
  if (!user.identifier) {
    throw new NotFoundError(
      "No UUID could be found for the specified username",
    );
  }
  return user.identifier;
};

const allowedRegex = /^[A-Za-z0-9_-]+$/;
export const assertUserNameAllowed = async (name: string) => {
  if (!name.match(allowedRegex)) {
    throw new UnauthorizedError("Filtered username");
  }
  const usernameIsReserved = (
    await READER`SELECT EXISTS(SELECT 1 FROM reserved_usernames WHERE username = ${name})`
  )[0].exists;
  if (usernameIsReserved) {
    throw new ReservedError("Username is reserved");
  }
  if (
    name.length > config.skybook.username_max_length ||
    name.length < config.skybook.username_min_length
  )
    throw new BadRequestError(
      "Specified username is not permitted by length limitations",
    );

  return true;
};
export const createUser = async (
  name: string,
  password: string,
  ip: string,
  invite?: string,
  DB = WRITER,
): Promise<string> => {
  if (!(await signupEnabled())) {
    throw new UnavailableError(
      "Attempted to sign up while signing up is disabled",
    );
  }
  await assertUserNameAllowed(name);
  if (password.length < 8) {
    throw new ForbiddenError("Password is too short");
  }

  if (await signupInvitationRequired()) {
    if (!invite) throw new UnauthorizedError("No invitation provided");
    if (!(await invitationIsValid(invite)))
      throw new UnauthorizedError("Provided invitation token is invalid");
  }
  try {
    password = await Bun.password.hash(password);
    const userIdentifier = generateToken();
    const user = await DB.begin(async (tx) => {
      const [user] =
        await tx`INSERT INTO users (name, identifier, password_hash, ip_hash) VALUES (${name},${userIdentifier},${password},${hashIp(ip)}) RETURNING name`;

      await tx`INSERT INTO instances (name, user_identifier) VALUES (${name}, ${userIdentifier})`;

      return user;
    });

    const token = await createSession(name, DB);
    return token;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
let DUMMY_PASSWORD_HASH: string;
(async () => {
  DUMMY_PASSWORD_HASH = await Bun.password.hash(
    randomBytes(32).toString("hex"),
  );
})();
export const userPasswordIsValid = async (
  identifier: string,
  password: string,
): Promise<boolean> => {
  const [userEntry] =
    await READER`SELECT name, identifier, password_hash FROM users WHERE identifier = ${identifier}`;
  if (!userEntry) throw new NotFoundError("User not found");
  if (await Bun.password.verify(password, (userEntry as User).password_hash))
    return true;
  else return false;
};
export const loginUser = async (
  name: string,
  password: string,
  otp?: string,
): Promise<string> => {
  if (!(await loginEnabled())) {
    throw new UnavailableError(
      "Attempted to log in while logging in is globally disabled",
    );
  }
  const userEntry = (
    await READER`SELECT name, identifier, totp_secret, can_login, password_hash FROM users WHERE name = ${name}`
  )[0] as Pick<
    User,
    "name" | "identifier" | "totp_secret" | "can_login" | "password_hash"
  >;

  if (!userEntry) {
    await Bun.password.verify(password, DUMMY_PASSWORD_HASH);
  }
  const validPassword = userEntry
    ? await Bun.password.verify(password, (userEntry as User).password_hash)
    : false;
  if (!userEntry || !validPassword) {
    throw new UnauthorizedError(
      "Attempted to log in as a user with invalid credentials",
    );
  }
  const identifier = userEntry.identifier;
  if (!userEntry.can_login) {
    throw new LockedError("Attempted to log in as a user with login disabled");
  }
  if (userEntry.totp_secret) {
    if (!otp || !(await verifyTotp(userEntry.totp_secret, otp))) {
      throw new UnauthorizedError(
        "Invalid or missing one-time password while attempting to log in as a user with TOTP enabled",
      );
    }
  }
  if (await userIsPendingDeletion(identifier))
    await cancelUserDeletion(identifier);

  return await createSession(name);
};

const updateUserLastSeenTime = async (identifier: string): Promise<void> => {
  await WRITER`UPDATE users SET last_seen = now() WHERE identifier = ${identifier}`;
};
export const authenticateUser = async (
  token: string,
): Promise<RequestContext["user"]> => {
  if (!loginEnabled) {
    throw new UnavailableError(
      "Attempted to login while logging in is disabled",
    );
  }
  const user = await getSessionUser(token);
  if (user) {
    await updateUserLastSeenTime(user.identifier);
    return user;
  } else {
    throw new UnauthorizedError("Provided session token does not exist.");
  }
};

export const enableUserMfa = async (
  identifier: string,
  secret: string,
  recoveryCodes: string[],
): Promise<void> => {
  const [userEntry] =
    await READER`SELECT name,identifier,totp_secret FROM users WHERE identifier=${identifier}`;
  if (!userEntry) throw new NotFoundError("User not found");
  if (userEntry.totp_secret)
    throw new BadRequestError("MFA Is already enabled for this user!");
  await WRITER`UPDATE users SET totp_secret = ${secret}, mfa_recovery =  ${WRITER.array(recoveryCodes, "TEXT")} WHERE identifier = ${identifier}`;
  await revokeAllSessions(identifier);
  return;
};

export const disableUserMfa = async (identifier: string): Promise<void> => {
  await WRITER`UPDATE users SET totp_secret = NULL, mfa_recovery = NULL WHERE identifier = ${identifier}`;
  return;
};

export const changeUserPassword = async (
  identifier: string,
  oldPassword: string,
  newPassword: string,
  otp?: string,
): Promise<void> => {
  const [userEntry] =
    await READER`SELECT name, identifier, totp_secret, can_change_password, password_hash FROM users WHERE identifier = ${identifier}`;
  console.log(userEntry);
  if (
    !userEntry.can_change_password ||
    !(await Bun.password.verify(oldPassword, userEntry.password_hash)) ||
    !passwordIsSafe(newPassword)
  ) {
    throw new UnauthorizedError(
      "Attempted to change password with either invalid former password, password changing disabled, or unsafe new password",
    );
  }
  if (userEntry.totp_secret) {
    if (!otp || !(await verifyTotp(userEntry.totp_secret, otp))) {
      throw new UnauthorizedError(
        "Invalid one time password provided while attempting to change password",
      );
    }
  }
  const newPasswordHash = await Bun.password.hash(newPassword);
  await WRITER.begin(async (tx) => {
    await tx`UPDATE users SET password_hash = ${newPasswordHash} WHERE identifier = ${identifier}`;
    await revokeAllSessions(identifier, tx);
  });
};
export const resetUserPassword = async (identifier: string) => {
  const password = btoa(crypto.getRandomValues(new BigUint64Array(2)).join());

  await WRITER.begin(async (tx) => {
    await tx`UPDATE users SET password_hash = ${await Bun.password.hash(password)} WHERE identifier = ${identifier}`;
    await revokeAllSessions(identifier, tx);
  });
  return password;
};

export const userIsPendingDeletion = async (identifier: string) => {
  return (
    await READER`SELECT pending_deletion FROM users WHERE identifier = ${identifier}`
  )[0].pending_deletion;
};

export const deleteUser = async (
  ctx: RequestContext,
  identifier: string,
): Promise<void> => {
  await WRITER.begin(async (tx) => {
    await tx`UPDATE users SET pending_deletion = true, delete_at = (now() + INTERVAL '7 days') WHERE identifier = ${identifier}`;
    await revokeAllSessions(identifier, tx);
  });
};

export const cancelUserDeletion = async (identifier: string): Promise<void> => {
  await WRITER`UPDATE users SET pending_deletion = false, delete_at = null WHERE identifier = ${identifier}`;
};

// Clear users who have not been seen for over one year
export const clearUnseenUsers = async (): Promise<void> => {};

export const userCanBeBlocked = async (uuid: string): Promise<boolean> => {
  const [res] =
    await READER`SELECT can_be_blocked FROM users WHERE identifier = ${uuid}`;
  if (!res) {
    throw new NotFoundError("Specified user does not exist");
  }
  return res.can_be_blocked;
};
export const userCanPost = async (uuid: string): Promise<boolean> => {
  return (await READER`SELECT can_post FROM users WHERE identifier=${uuid}`)[0]
    .can_post;
};
