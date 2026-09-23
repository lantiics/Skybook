import { test, expect, describe } from "bun:test";
import { baseTOTPUser, baseUser, harnessedUser } from "./harness";
import { createUser, loginUser } from "@/domain/users";
import { UnauthorizedError, UnavailableError } from "@/errors";
import { withLoginDisabled, withSignupDisabled } from "./skybook.test";
import { generateOTP } from "root/src/domain/auth";

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
