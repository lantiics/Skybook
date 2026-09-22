import { test, expect } from "bun:test";
import { WRITER } from "@/db";
import { harnessedUser } from "./harness";
import { createUser, loginUser } from "@/domain/users";
import { UnavailableError } from "@/errors";
import { withLoginDisabled, withSignupDisabled } from "./skybook.test";

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

test("Trying to sign up with login disabled fails", async () => {
  const uName = harnessedUser();
  createUser(uName, "123123123123", "skybook-harness-ip-logindisabledtest");
  expect(
    withLoginDisabled(async () => await loginUser(uName, "123123123123")),
  ).rejects.toThrow(UnavailableError);
});
