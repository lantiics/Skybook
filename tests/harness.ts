import { beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { createSession, getSessionUser } from "@domain/sessions";
import { WRITER } from "../src/db";
import { RequestContext } from "root/src/types/context";
import { hashIp } from "root/src/domain/ip";

export const createUser = async (
  name: string,
  password: string,
  ip: string,
  DB = WRITER,
): Promise<string> => {
  password = await Bun.password.hash(password);
  const userIdentifier = "skybook-harness";
  const user = await DB.begin(async (tx) => {
    console.log("generating user");
    const [user] =
      await tx`INSERT INTO users (name, identifier, password_hash, ip_hash) VALUES (${name},${userIdentifier},${password},${hashIp(ip)}) RETURNING name`;
    console.log("generating instance");
    await tx`INSERT INTO instances (name, user_identifier) VALUES (${name}, ${userIdentifier})`;

    return user;
  });
  console.log("generating session");
  const token = await createSession(name, DB);
  return token;
};

export let tx: typeof WRITER;
beforeAll(async () => {
  tx = await WRITER.reserve();
  await tx`BEGIN`;
  sessionToken = await createUser(
    "test-harness",
    "12345678",
    "ip_address-TESTINGUSER",
    tx,
  );
  userIdentifier = ((await getSessionUser(sessionToken)) as any).identifier;
});

afterAll(async () => {
  await tx`ROLLBACK`;
  //@ts-expect-error
  tx.release();
});

beforeEach(async () => {
  await tx`SAVEPOINT test_start`;
});

afterEach(async () => {
  await tx`ROLLBACK TO SAVEPOINT test_start`;
});

export const instance = "test-harness";
const baseCtx = { instance, elevated: false };
const userCtx = { name: "test-harness", identifier: "skybook-harness" };
export let ctx = {
  anonymous: { ...baseCtx, ip: "anonIP" },
  authorized: {
    ...baseCtx,
    ...userCtx,
    ip: "authorizedIP",
  },
  elevated: {
    ...baseCtx,
    ...userCtx,
    elevated: true,
    ip: "elevatedIP",
  },
};
let sessionToken;
let userIdentifier;
