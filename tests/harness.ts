import { beforeAll, afterAll } from "bun:test";
import { createSession } from "@domain/sessions";
import { WRITER } from "../src/db";
import { hashIp } from "@/domain/ip";
export const harnessUserPassword = "12345678";
export const harnessedUser = () => {
  return `harness-${crypto.randomUUID().slice(0, 8)}`;
};
export const harnessUserName = `harness-${crypto.randomUUID().slice(0, 8)}`;
export const harnessUserIP = "skybook-harness-ip";
export const harnessUserIdentifier = crypto.randomUUID();

export const createUser = async (
  name: string,
  password: string,
  ip: string,
  invite?: string,
  DB = WRITER,
): Promise<string> => {
  try {
    password = await Bun.password.hash(password);
    const user = await DB.begin(async (tx) => {
      const [user] =
        await tx`INSERT INTO users (name, identifier, password_hash, ip_hash) VALUES (${name},${harnessUserIdentifier},${password},${hashIp(ip)}) RETURNING name`;
      await tx`INSERT INTO instances (name, user_identifier) VALUES (${name}, ${harnessUserIdentifier})`;

      return user;
    });

    const token = await createSession(name, DB);
    return token;
  } catch (e) {
    throw e;
  }
};
beforeAll(async () => {
  await WRITER`DELETE FROM sessions WHERE user_name LIKE 'harness-%'`;
  await WRITER`DELETE FROM users WHERE name LIKE 'harness-%'`;
  await WRITER`DELETE FROM instances WHERE name LIKE 'harness-%'`;
  await WRITER`DELETE FROM overrides WHERE instance LIKE 'harness-%'`;

  sessionToken = await createUser(
    harnessUserName,
    harnessUserPassword,
    harnessUserIP,
  );
});

afterAll(async () => {
  await WRITER`DELETE FROM sessions WHERE user_name = ${harnessUserName}`;
  await WRITER`DELETE FROM users WHERE name = ${harnessUserName}`;
  await WRITER`DELETE FROM instances WHERE name = ${harnessUserName}`;
  await WRITER`DELETE FROM overrides WHERE instance = ${harnessUserName}`;
});

const baseCtx = {
  instance: harnessUserName,
  elevated: false,
  superAdmin: false,
  authenticated: false,
};
const userCtx = { name: harnessUserName, identifier: harnessUserIdentifier };
export let ctx = {
  anonymous: { ...baseCtx, ip: `${harnessUserIP}-anonIP` },
  authorized: {
    ...baseCtx,
    ...userCtx,
    ip: `${harnessUserIP}-authorizedIP`,
    authenticated: true,
  },
  elevated: {
    ...baseCtx,
    ...userCtx,
    elevated: true,
    ip: `${harnessUserIP}-elevatedIP`,
    authenticated: true,
  },
};
let sessionToken;
