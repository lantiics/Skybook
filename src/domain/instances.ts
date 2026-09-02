import { RequestContext } from "../types/context.ts";
import { Field, Post } from "../types/entities.ts";
import { DB } from "../db.ts";
import { LockedError } from "../errors.ts";
import { PUBLIC_COLUMN_NAMES, PRIVATE_COLUMN_NAMES } from "../defaults.ts";
import { setField, allFieldsAreWritable } from "./fields.ts";
import { sql } from "bun";
import { hashIp } from "./ip.ts";

const _USER_FACING_COLUMN_NAMES = [
  ...PUBLIC_COLUMN_NAMES,
  ...PRIVATE_COLUMN_NAMES,
];
interface Status {
  status: boolean;
  locked?: boolean;
}

export const instanceExists = async (instance: string) => {
  const [instanceExists] =
    await DB`SELECT EXISTS(SELECT 1 FROM instances WHERE name = ${instance})`;
  return instanceExists.exists;
};
const _getInstanceOverride = async (instance: string, name: string) => {
  const [override] = await DB`
  SELECT value FROM overrides
  WHERE name = ${name} AND instance = ${instance}
  ORDER BY instance NULLS LAST
  LIMIT 1`;
  console.log(override, ":override", instance, name);

  return override?.value;
};
export const _getSpecifiedInstanceStatus = async (
  instance: string,
  name: string,
): Promise<Status> => {
  console.log("woof");
  if (
    ![
      "is_visible",
      "submission_enabled",
      "approval_required",
      "replying_enabled",
      "flagging_enabled",
      "queue_on_filtered",
    ].includes(name)
  ) {
    throw new Error("Requested status is not permitted");
  }
  const override = await _getInstanceOverride(instance, name);
  let localStatus;
  if (override === undefined) {
    localStatus = (
      await DB`SELECT ${DB(name)} FROM instances WHERE name = ${instance}`
    )[0][name];
  }
  console.log(override, localStatus);

  const status: Status = {
    status: localStatus ?? override,
  };
  if (override !== undefined) {
    status.locked = true;
  }
  console.log(status, "status!!!!");

  //@ts-expect

  // !override.locked
  //   ? (status[name] = (
  //       await DB`SELECT ${sql(name)} FROM instances WHERE name = ${ctx.instance}`
  //     )[0][name])
  //   : {
  //       locked: true,
  //       status: override.value,
  //     };
  console.log(status, "aba");
  return status;
};
export const isVisible = async (instance: string): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(instance, "is_visible");
  return status;
};
export const submissionEnabled = async (instance: string): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "submission_enabled",
  );
  return status;
};
export const replyingEnabled = async (instance: string): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "replying_enabled",
  );
  console.log(status, "aa");
  return status;
};
export const approvalRequired = async (instance: string): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "approval_required",
  );
  return status;
};
export const flaggingEnabled = async (instance: string): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "flagging_enabled",
  );
  return status;
};

export const instanceQueuesFilteredPosts = async (
  instance: string,
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "queue_on_filtered",
  );
  return status;
};

export const compiledInstanceStatus = async (
  instance: string,
): Promise<Record<string, Status>> => {
  const status = {
    is_visible: await isVisible(instance),
    submission_enabled: await submissionEnabled(instance),
    replying_enabled: await replyingEnabled(instance),
    approval_required: await approvalRequired(instance),
    flagging_enabled: await flaggingEnabled(instance),
  };

  console.log(status);
  return status;
};

export const blockUser = async (instance: string, uuid: string) => {};
export const unblockUser = async (instance: string, uuid: string) => {};

export const instanceHasRequesterBlocked = async (
  instance: string,
  uuid: string,
  ipHash: string,
) => {
  console.log(ipHash);
  if (
    (
      await DB`SELECT EXISTS(SELECT 1 FROM instance_blocks WHERE instance = ${instance} AND ${uuid !== "" ? DB`(user_identifier = ${uuid} OR ip_hash = ${ipHash}` : DB`ip_hash = ${ipHash}`})`
    )[0].exists
  )
    return true;
  return false;
};

const _toggleSpecifiedInstanceStatus = async (
  instance: string,
  name: string,
) => {
  if (
    ![
      "is_visible",
      "submission_enabled",
      "requires_approval",
      "replying_enabled",
      "flagging_enabled",
      "queue_on_filtered",
    ].includes(name)
  ) {
    throw new SyntaxError(
      "Invalid status name while attempting to toggle status",
    );
  }
  const override = await _getInstanceOverride(instance, name);
  if (override !== undefined) {
    throw new LockedError(
      `Instance status ${name} is locked as ${override} via a system-level override and cannot be toggled without system-level administrative privileges.`,
    );
  }
  console.log(override);

  const status =
    await DB`UPDATE instances SET ${DB(name)} = NOT ${DB(name)} WHERE name = ${instance} RETURNING ${DB(name)}`;
  return status;
};

// Convenience functions
export const toggleInstanceVisibility = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "is_visible");
};
export const toggleInstanceSubmission = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "submission_enabled");
};
export const toggleInstanceReplying = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "replying_enabled");
};
export const toggleInstanceApproval = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "requires_approval");
};
export const toggleInstanceFlagging = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "flagging_enabled");
};
export const toggleInstanceQueueOnFiltered = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "queue_on_filtered");
};

const exportInstance = async (ctx: RequestContext) => {
  return {
    entries:
      await DB`SELECT ${DB.unsafe(_USER_FACING_COLUMN_NAMES.join(","))} FROM posts WHERE instance = ${ctx.instance}`,
    fields: await DB`SELECT * FROM fields WHERE instance = ${ctx.instance}`,
  };
};
const importInstance = async (
  ctx: RequestContext,
  data: { fields: Field[]; entries: Post[] },
) => {
  for (const field of data.fields) {
    try {
      setField(ctx, field);
    } catch {
      continue; // An error will be thrown if a field is disallowed, we only care about user-created fields so we ignore it.
    }
  }
  for (const entry of data.entries) {
    if (await allFieldsAreWritable(ctx.instance, Object.keys(entry))) {
      const row =
        await DB`INSERT INTO posts (${DB`${Object.values(entry)}`}) RETURNING *`;
    }
  }
  return { ok: true };
};
