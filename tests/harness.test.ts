import { test, expect, describe } from "bun:test";
import { baseTOTPUser, baseUser } from "./harness";
import { WRITER } from "root/src/db";

describe("Harness is valid", () => {
  test("baseUser has valid identifier", async () => {
    expect(baseUser.identifier).toBeDefined();
  });
  test("baseUser name actually exists in the database", async () => {
    const { user, instance } = await WRITER.begin(async (tx) => {
      const [user] =
        await tx`SELECT EXISTS(SELECT 1 FROM users WHERE name=${baseUser.name})`;
      const [instance] =
        await tx`SELECT EXISTS(SELECT 1 FROM instances WHERE name=${baseUser.name})`;
      return { user: user.exists, instance: instance.exists };
    });
    expect(user).toBeTrue();
    expect(instance).toBeTrue();
  });
  test("baseTOTPUser has MFA enabled", async () => {
    const [{ mfa_enabled: mfaEnabled }] =
      await WRITER`SELECT mfa_enabled FROM users WHERE name = ${baseTOTPUser.name}`;
    expect(mfaEnabled).toBeTrue();
  });
});
