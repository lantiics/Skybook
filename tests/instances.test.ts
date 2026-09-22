import { test, expect } from "bun:test";
import { ctx, harnessUserName } from "./harness";
import { WRITER } from "root/src/db";

export const withVisibilityDisabled = async (f: any) => {
  await WRITER`UPDATE instances SET is_visible = false WHERE name = ${harnessUserName}`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE instances SET is_visible = true WHERE name = ${harnessUserName}`;
  }
};

export const withSubmissionDisabled = async (f: any) => {
  await WRITER`UPDATE instances SET submission_enabled = false WHERE name = ${harnessUserName}`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE instances SET submission_enabled = true WHERE name = ${harnessUserName}`;
  }
};

export const wtihApprovalEnabled = async (f: any) => {
  await WRITER`UPDATE instances SET approval_required = true WHERE name = ${harnessUserName}`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE instances SET approval_required = false WHERE name = ${harnessUserName}`;
  }
};
