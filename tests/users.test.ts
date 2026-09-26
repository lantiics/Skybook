import { test, expect, describe, afterAll } from "bun:test";
import { baseTOTPUser, baseUser, ctx, harnessedUser } from "./harness";
import { createUser, loginUser } from "@/domain/users";
import { NotFoundError, UnauthorizedError, UnavailableError } from "@/errors";
import { withLoginDisabled, withSignupDisabled } from "./skybook.test";
import { generateOTP } from "root/src/domain/auth";
import { WRITER } from "root/src/db";
import { newInvitation } from "root/src/domain/invitations";

test("Trying to sign up with signup disabled fails", async () => {
  expect(
    withSignupDisabled(
      async () =>
        await createUser(
          harnessedUser(),
          "123123123123",
          "skybook-harness-ip-signupdisabledtest",
        ),
    ),
  ).rejects.toThrow(UnavailableError);
});

test("Trying to log in with login disabled fails", async () => {
  expect(
    withLoginDisabled(
      async () => await loginUser(baseUser.name, baseUser.password),
    ),
  ).rejects.toThrow(UnavailableError);
});

describe("TOTP", async () => {
  test("Logging in with invalid OTP fails", async () => {
    expect(
      loginUser(baseTOTPUser.name, baseTOTPUser.password, "123123"),
    ).rejects.toThrow(UnauthorizedError);
  });
  test("Logging in with valid OTP succeeds", async () => {
    expect(
      loginUser(
        baseTOTPUser.name,
        baseTOTPUser.password,
        await generateOTP(baseTOTPUser.mfa.secret),
      ),
    ).resolves.toBeTypeOf("string");
  });
});

describe("Signup with invitations enabled", async () => {
  await WRITER`UPDATE service_settings SET value=true WHERE name='signup_requires_invitation'`;
  const code = await newInvitation(ctx.authorized.identifier!);

  test("Signing up with invitation required and no invitation code specified is rejected", async () => {
    expect(
      createUser(harnessedUser(), crypto.randomUUID(), crypto.randomUUID()),
    ).rejects.toThrow(UnauthorizedError);
  });
  test("Signing up with a valid invitation code succeeds and increments invitation uses count", async () => {
    expect(
      createUser(
        harnessedUser(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        code,
      ),
    ).resolves.toBeString();
    const [{ uses: uses }] =
      await WRITER`SELECT uses FROM invitations WHERE token=${code}`;
    expect(uses).toBe(1);
  });
  test("Signing up with invitations at use limit rejects", async () => {
    await WRITER`UPDATE invitations SET uses=3 WHERE token=${code}`;
    expect(
      createUser(
        harnessedUser(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        code,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  afterAll(async () => {
    await WRITER`UPDATE service_settings SET value=false WHERE name='signup_requires_invitation'`;
  });
});
