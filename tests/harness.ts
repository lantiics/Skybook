import { beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { createSession, getSessionUser } from "@domain/sessions";
import { WRITER } from "../src/db";
import { RequestContext } from "root/src/types/context";
import { hashIp } from "root/src/domain/ip";
import { createUser } from "root/src/domain/users";
export const harnessUserPassword = "12345678";
export const harnessUserName = `harness-${crypto.randomUUID().slice(0, 8)}`;
export const harnessUserIP = "skybook-harness-ip";
export const harnessUserIdentifier = crypto.randomUUID();

export let tx: typeof WRITER;
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

const baseCtx = { instance: harnessUserName, elevated: false };
const userCtx = { name: harnessUserName, identifier: harnessUserIdentifier };
export let ctx = {
  anonymous: { ...baseCtx, ip: `${harnessUserIP}-anonIP` },
  authorized: {
    ...baseCtx,
    ...userCtx,
    ip: `${harnessUserIP}-authorizedIP`,
  },
  elevated: {
    ...baseCtx,
    ...userCtx,
    elevated: true,
    ip: `${harnessUserIP}-elevatedIP`,
  },
};
let sessionToken;
