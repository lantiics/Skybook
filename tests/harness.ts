import { beforeAll, afterAll } from "bun:test";
import { createSession, getSessionUser } from "@domain/sessions";
import { WRITER } from "../src/db";
import { hashIp } from "@/domain/ip";

import { setupTwoFactor } from "root/src/domain/auth";
import { enableUserMfa } from "root/src/domain/users";

export const harnessUserPassword = "12345678";
export const harnessedUser = () => {
  return `harness-${crypto.randomUUID().slice(0, 8)}`;
};

const createUser = async (
  name: string,
  password: string,
  ip: string,
  invite?: string,
  DB = WRITER,
): Promise<any> => {
  try {
    password = await Bun.password.hash(password);
    const identifier = crypto.randomUUID();
    const user = await DB.begin(async (tx) => {
      const [user] =
        await tx`INSERT INTO users (name, identifier, password_hash, ip_hash) VALUES (${name},${identifier},${password},${hashIp(ip)}) RETURNING name`;
      await tx`INSERT INTO instances (name, user_identifier) VALUES (${name}, ${identifier})`;

      return user;
    });

    const token = await createSession(name, DB);
    return { token, user, identifier };
  } catch (e) {
    console.error(e);
    throw e;
  }
};
export const generateUser = async () => {
  const name = harnessedUser();
  const password = crypto.randomUUID();
  const ip = `harness-${crypto.randomUUID()}`;
  const info = await createUser(name, password, ip);
  const token = info.token;
  return { name, password, ip, token, info, identifier: info!.identifier };
};
export const baseUser = await generateUser();

// export let baseUser;
const btN = await generateUser();
const btuM = await setupTwoFactor(btN.name);
console.log(btuM, "yeaaa");
export const baseTOTPUser = {
  ...btN,
  mfa: btuM,
};

beforeAll(async () => {
  // await WRITER`DELETE FROM sessions WHERE user_name LIKE 'harness-%'`;
  // await WRITER`DELETE FROM users WHERE name LIKE 'harness-%'`;
  // await WRITER`DELETE FROM instances WHERE name LIKE 'harness-%'`;
  // await WRITER`DELETE FROM overrides WHERE instance LIKE 'harness-%'`;

  sessionToken = baseUser.token;
  await enableUserMfa(
    baseTOTPUser.identifier,
    baseTOTPUser.mfa.secret,
    baseTOTPUser.mfa.codes,
  );
});

afterAll(async () => {
  await WRITER`DELETE FROM sessions WHERE user_name LIKE 'harness-%'`;
  await WRITER`DELETE FROM users WHERE name LIKE 'harness-%'`;
  await WRITER`DELETE FROM instances WHERE name LIKE 'harness-%'`;
  await WRITER`DELETE FROM overrides WHERE instance LIKE 'harness-%'`;
});

const baseCtx = {
  instance: baseUser.name,
  elevated: false,
  superAdmin: false,
  authenticated: false,
};
const userCtx = { name: baseUser.name, identifier: baseUser.identifier };
export let ctx = {
  anonymous: { ...baseCtx, ip: `${baseUser.ip}-anonIP` },
  authorized: {
    ...baseCtx,
    ...userCtx,
    ip: `${baseUser.ip}-authorizedIP`,
    authenticated: true,
  },
  elevated: {
    ...baseCtx,
    ...userCtx,
    elevated: true,
    ip: `${baseUser.ip}-elevatedIP`,
    authenticated: true,
  },
};
let sessionToken;
