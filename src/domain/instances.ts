import { RequestContext } from "../types/context.ts";
import { Field, Post } from "../types/entities.ts";
import { DB } from "../db.ts";
import { LockedError } from "../errors.ts";
import { PUBLIC_COLUMN_NAMES, PRIVATE_COLUMN_NAMES } from "../defaults.ts";
import { setField, allFieldsAreWritable } from "./fields.ts";
import { sql } from "bun";
import { hashIp } from "./ip.ts";

const EXPORTABLE_COLUMN_NAMES = [
  "author",
  "content",
  "extra",
  "reply",
  "added",
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
  // console.log(override, ":override", instance, name);

  return override?.value;
};
export const _getSpecifiedInstanceStatus = async (
  instance: string,
  name: string,
): Promise<Status> => {
  // console.log("woof");
  if (
    ![
      "is_visible",
      "submission_enabled",
      "approval_required",
      "replying_enabled",
      "flagging_enabled",
      "queue_on_filtered",
      "custom_filter",
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
  const status: Status = {
    status: localStatus ?? override,
  };
  if (override !== undefined) {
    status.locked = true;
  }
  // console.log(status, "status!!!!");

  //@ts-expect

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
// export const replyingEnabled = async (instance: string): Promise<Status> => {
//   const status = await _getSpecifiedInstanceStatus(
//     instance,
//     "replying_enabled",
//   );
//   console.log(status, "aa");
//   return status;
// };
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

export const instanceSuppliedFilter = async (
  instance: string,
): Promise<string> => {
  return (
    await DB`SELECT custom_filter FROM instances WHERE name = ${instance}`
  )[0].custom_filter;
};

export const instanceBlocksProxyAddresses = async (
  instance: string,
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "blocklist_proxy_enabled",
  );
  return status;
};
export const instanceBlocksVPNAddresses = async (
  instance: string,
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "blocklist_vpn_enabled",
  );
  return status;
};
export const instanceBlocksTorAddresses = async (
  instance: string,
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "blocklist_tor_enabled",
  );
  return status;
};

export const instanceIpBlocks = async (
  instance: string,
): Promise<Record<"proxy" | "vpn" | "tor", boolean>> => {
  return (
    await DB`SELECT blocklist_proxy_enabled AS proxy,blocklist_vpn_enabled AS vpn,blocklist_tor_enabled AS tor FROM instances WHERE name = ${instance}`
  )[0];
};

export const compiledInstanceStatus = async (
  instance: string,
): Promise<Record<string, Status>> => {
  const status = {
    is_visible: await isVisible(instance),
    submission_enabled: await submissionEnabled(instance),
    // replying_enabled: await replyingEnabled(instance),
    approval_required: await approvalRequired(instance),
    flagging_enabled: await flaggingEnabled(instance),
    queue_on_filtered: await instanceQueuesFilteredPosts(instance),
  };

  return status;
};

export const blockUser = async (
  instance: string,
  uuid: string,
  reason?: string,
): Promise<void> => {
  await DB.begin(async (tx) => {
    await tx`INSERT INTO instance_user_blocks (instance, user_identifier, reason) VALUES (${instance},${uuid},${reason})`;
    await tx`UPDATE posts AS t1 
    SET creator_user_blocked_reason = t2.reason
    FROM instance_user_blocks AS t2 
    WHERE t1.authenticated_user_identifier = t2.user_identifier
    AND t1.instance = ${instance}`;
  }); //`INSERT INTO instance_user_blocks (instance,user_identifier,reason) VALUES (${instance},${uuid},${reason})`;
};
export const unblockUser = async (
  instance: string,
  uuid: string,
): Promise<void> => {
  await DB`DELETE FROM instance_user_blocks WHERE user_identifier = ${uuid} AND instance = ${instance};`;
};

export const instanceHasRequesterBlocked = async (
  instance: string,

  ipHash: string,
  uuid?: string,
) => {
  if (
    (
      await DB`SELECT EXISTS(SELECT 1 FROM instance_blocks WHERE instance = ${instance} AND ${uuid !== "" ? DB`(user_identifier = ${uuid} OR ip_hash = ${ipHash})` : DB`ip_hash = ${ipHash}`}) OR EXISTS (SELECT 1 FROM global_ip_blocks WHERE ip_hash=${ipHash})`
    )[0]["?column?"]
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
      "approval_required",
      "replying_enabled",
      "flagging_enabled",
      "queue_on_filtered",
      "custom_filter",
      //
      "blocklist_proxy_enabled",
      "blocklist_vpn_enabled",
      "blocklist_tor_enabled",
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
  return await _toggleSpecifiedInstanceStatus(instance, "approval_required");
};
export const toggleInstanceFlagging = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "flagging_enabled");
};
export const toggleInstanceQueueOnFiltered = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(instance, "queue_on_filtered");
};

export const updateInstanceSuppliedFilter = async (
  instance: string,
  filter: string,
) => {
  return await DB`UPDATE instances SET custom_filter = ${filter} WHERE name = ${instance}`;
};

// ip address blocking
export const toggleInstanceProxyBlacklist = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(
    instance,
    "blocklist_proxy_enabled",
  );
};
export const toggleInstanceVPNBlacklist = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(
    instance,
    "blocklist_vpn_enabled",
  );
};
export const toggleInstanceTorBlacklist = async (instance: string) => {
  return await _toggleSpecifiedInstanceStatus(
    instance,
    "blocklist_tor_enabled",
  );
};
// Implement default, Kaiju-provided filters for instances
export const enableInstanceDefaultFilter = async (
  instance: string,
  filter: string,
) => {
  await DB`INSERT INTO instance_filters (instance, filter) VALUES (${instance},${filter})
  ON CONFLICT (instance, filter) DO NOTHING`;
};
export const disableInstanceDefaultFilter = async (
  instance: string,
  filter: string,
) => {
  await DB`DELETE FROM instance_filters WHERE instance = ${instance} AND filter = ${filter}`;
};

// booleans
export const instanceEnabledDefaultFilters = async (instance: string) => {
  let filters: Record<string, boolean> = {};
  const [filterQuery] =
    await DB`SELECT filter FROM instance_filters WHERE instance = ${instance}`;
  for (const filter of Object.values(filterQuery ?? {})) {
    filters[filter as string] = true;
  }
  console.log(filters, "filters here in thee tihng");
  return filters;
};
// Filter lists
export const instanceDefaultFilters = async (instance: string) => {
  const [filtersQuery] = await DB`SELECT filter FROM filters t1
  WHERE t1.identifier IN (
  SELECT t2.filter
  FROM instance_filters t2
  WHERE t2.instance = ${instance})`;
  if (filtersQuery) {
    const filters = Object.values(filtersQuery).join("|");
    console.log(filters, "filter lsits yea yea");
    return filters;
  } else return null;
};
export const exportInstance = async (ctx: RequestContext) => {
  return {
    entries:
      await DB`SELECT ${DB.unsafe(EXPORTABLE_COLUMN_NAMES.join(","))} FROM posts WHERE instance = ${ctx.instance}`,
    fields: await DB`SELECT * FROM fields WHERE instance = ${ctx.instance}`,
  };
};
export const importInstance = async (
  ctx: RequestContext,
  data: { fields: Field[]; entries: Post[] },
) => {
  console.log(data, "import data");
  for (const field of data.fields) {
    try {
      setField(ctx, field);
    } catch {
      continue; // An error will be thrown if a field is disallowed, we only care about user-created fields so we ignore it.
    }
  }
  for (const entry of data.entries) {
    const inputFields = ["author", "content", ...Object.keys(entry.extra)];
    console.log(inputFields);
    if (await allFieldsAreWritable(ctx.instance, inputFields)) {
      console.log("continuing");
      const clearedEntry = {
        instance: ctx.instance,
        author: entry.author,
        content: entry.content,
        extra: entry.extra,
        reply: entry.reply,
        added: entry.added,
        identifier: crypto.randomUUID(),
      };
      const row = await DB`INSERT INTO posts ${DB(clearedEntry)} RETURNING *`;
    } else {
      console.error("naw");
    }
  }
  return { ok: true };
};
