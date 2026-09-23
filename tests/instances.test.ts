import { test, expect } from "bun:test";
import { ctx } from "./harness";
import { WRITER } from "root/src/db";

export const withVisibilityDisabled = async (f: any) => {
  await WRITER`UPDATE instances SET is_visible = false WHERE name = ${ctx.anonymous.instance}`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE instances SET is_visible = true WHERE name = ${ctx.anonymous.instance}`;
  }
};

export const withSubmissionDisabled = async (f: any) => {
  await WRITER`UPDATE instances SET submission_enabled = false WHERE name = ${ctx.anonymous.instance}`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE instances SET submission_enabled = true WHERE name = ${ctx.anonymous.instance}`;
  }
};

export const wtihApprovalEnabled = async (f: any) => {
  await WRITER`UPDATE instances SET approval_required = true WHERE name = ${ctx.anonymous.instance}`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE instances SET approval_required = false WHERE name = ${ctx.anonymous.instance}`;
  }
};
