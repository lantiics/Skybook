import { WRITER } from "../db.ts";
import { RequestContext } from "../types/context";
import { InvalidStatusError } from "../errors.ts";
import { purgeInstanceCache } from "./cache.ts";

const ACCEPTED_STATUSES = [
  "approval_required",
  "submission_enabled",
  "replying_enabled",
  "is_visible",
  "flagging_enabled",
];

const _toggleOverride = async (ctx: RequestContext, status: string) => {
  if (!ACCEPTED_STATUSES.includes(status)) {
    throw new InvalidStatusError(
      "Invalid status specified while attempting to toggle override",
    );
  }
  if (["is_visible", "submission_enabled", "flagging_enabled"].includes(status))
    purgeInstanceCache(ctx.instance);
  await WRITER`INSERT INTO overrides (instance,name,value) VALUES (${ctx.instance ?? null},${status}, ${false}) ON CONFLICT ${ctx.instance ? WRITER.unsafe(`(instance, name) WHERE instance IS NOT NULL`) : WRITER.unsafe(`(name) WHERE instance IS NULL `)} DO UPDATE SET value = NOT overrides.value`;
};
const _deleteOverride = async (ctx: RequestContext, status: string) => {
  if (!ACCEPTED_STATUSES.includes(status)) {
    throw new InvalidStatusError(
      "Invalid status specified while attempting to delete override",
    );
  }
  await WRITER`DELETE FROM overrides WHERE name = ${status} AND instance ${ctx.instance ? WRITER`= ${ctx.instance}` : WRITER.unsafe("IS NULL")}`;
};
// Convenience functions
export const toggleApprovalOverride = async (ctx: RequestContext) => {
  return await _toggleOverride(ctx, "approval_required");
};

export const toggleSubmissionOverride = async (ctx: RequestContext) => {
  return await _toggleOverride(ctx, "submission_enabled");
};

export const toggleReplyingOverride = async (ctx: RequestContext) => {
  return await _toggleOverride(ctx, "replying_enabled");
};

export const toggleVisibilityOverride = async (ctx: RequestContext) => {
  return await _toggleOverride(ctx, "is_visible");
};
export const toggleFlaggingOverride = async (ctx: RequestContext) => {
  return await _toggleOverride(ctx, "flagging_enabled");
};

export const deleteApprovalOverride = async (ctx: RequestContext) => {
  return await _deleteOverride(ctx, "approval_required");
};
export const deleteSubmissionOverride = async (ctx: RequestContext) => {
  return await _deleteOverride(ctx, "submission_enabled");
};

export const deleteReplyingOverride = async (ctx: RequestContext) => {
  return await _deleteOverride(ctx, "replying_enabled");
};

export const deleteVisibilityOverride = async (ctx: RequestContext) => {
  return await _deleteOverride(ctx, "is_visible");
};

export const deleteFlaggingOverride = async (ctx: RequestContext) => {
  return await _deleteOverride(ctx, "flagging_enabled");
};
