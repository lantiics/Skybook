import { RequestContext } from "../types/context.ts";
import { Instance, Mutable, Post, User } from "../types/entities.ts";
import { READER, WRITER } from "../db.ts";
import {
  BadRequestError,
  LockedError,
  UnauthorizedError,
  UnavailableError,
} from "../errors.ts";
import { setField, allFieldsAreWritable } from "./fields.ts";
import { config } from "../config.ts";
import { purgeInstanceCache } from "./cache.ts";
import {
  encryptedURL,
  notificationUrlIsValidForService,
  notifyUser,
} from "./notifications.ts";

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

export const instanceExists = async (instance: Instance["name"]) => {
  const [instanceExists] =
    await READER`SELECT EXISTS(SELECT 1 FROM instances WHERE name = ${instance})`;
  return instanceExists.exists;
};
const _getInstanceOverride = async (
  instance: Instance["name"],
  name: string,
) => {
  const [override] = await READER`
  SELECT value FROM overrides
  WHERE name = ${name} AND instance = ${instance}
  ORDER BY instance NULLS LAST
  LIMIT 1`;

  return override?.value;
};
export const _getSpecifiedInstanceStatus = async (
  instance: Instance["name"],
  name: string,
): Promise<Status> => {
  if (
    ![
      "is_visible",
      "submission_enabled",
      "approval_required",
      "replying_enabled",
      "flagging_enabled",
      "queue_on_filtered",
      "custom_filter",
      "queue_flags_threshold",
      "blocklist_proxy_enabled",
      "blocklist_vpn_enabled",
      "blocklist_tor_enabled",
    ].includes(name)
  ) {
    throw new Error("Requested status is not permitted");
  }
  const override = await _getInstanceOverride(instance, name);
  let localStatus;
  if (override === undefined) {
    localStatus = (
      await READER`SELECT ${READER(name)} FROM instances WHERE name = ${instance}`
    )[0][name];
  }
  const status: Status = {
    status: localStatus ?? override,
  };
  if (override !== undefined) {
    status.locked = true;
  }

  return status;
};
export const isVisible = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(instance, "is_visible");
  return status;
};
export const submissionEnabled = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "submission_enabled",
  );
  return status;
};
export const approvalRequired = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "approval_required",
  );
  return status;
};
export const flaggingEnabled = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "flagging_enabled",
  );
  return status;
};

export const instanceQueuesFilteredPosts = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "queue_on_filtered",
  );
  return status;
};

export const InstanceQueueFlaggedThreshold = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "queue_flags_threshold",
  );
  return status;
};

export const instanceSuppliedFilter = async (
  instance: Instance["name"],
): Promise<string> => {
  return (
    await READER`SELECT custom_filter FROM instances WHERE name = ${instance}`
  )[0].custom_filter;
};

export const instanceBlocksProxyAddresses = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "blocklist_proxy_enabled",
  );
  return status;
};
export const instanceBlocksVPNAddresses = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "blocklist_vpn_enabled",
  );
  return status;
};
export const instanceBlocksTorAddresses = async (
  instance: Instance["name"],
): Promise<Status> => {
  const status = await _getSpecifiedInstanceStatus(
    instance,
    "blocklist_tor_enabled",
  );
  return status;
};

export const instanceIpBlocks = async (
  instance: Instance["name"],
): Promise<Record<"proxy" | "vpn" | "tor", boolean>> => {
  return (
    await READER`SELECT blocklist_proxy_enabled AS proxy,blocklist_vpn_enabled AS vpn,blocklist_tor_enabled AS tor FROM instances WHERE name = ${instance}`
  )[0];
};

export const compiledInstanceStatus = async (
  instance: Instance["name"],
): Promise<Record<string, Status>> => {
  const status = {
    is_visible: await isVisible(instance),
    submission_enabled: await submissionEnabled(instance),
    approval_required: await approvalRequired(instance),
    flagging_enabled: await flaggingEnabled(instance),
    queue_on_filtered: await instanceQueuesFilteredPosts(instance),
    queue_flags_threshold: await InstanceQueueFlaggedThreshold(instance),
  };

  return status;
};

export const instanceHasRequesterBlocked = async (
  instance: Instance["name"],

  ipHash: string,
  uuid?: User["identifier"],
) => {
  if (
    (
      await READER`SELECT EXISTS(SELECT 1 FROM instance_blocks WHERE instance = ${instance} AND ${uuid ? READER`(user_identifier = ${uuid} OR ip_hash = ${ipHash})` : READER`ip_hash = ${ipHash}`}) OR EXISTS (SELECT 1 FROM global_ip_blocks WHERE ip_hash=${ipHash})`
    )[0]["?column?"]
  )
    return true;
  return false;
};

//#region TOGGLES
const _toggleSpecifiedInstanceStatus = async (
  instance: Instance["name"],
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
    await WRITER`UPDATE instances SET ${WRITER(name)} = NOT ${WRITER(name)} WHERE name = ${instance} RETURNING ${WRITER(name)}`;
  if (["is_visible", "submission_enabled", "flagging_enabled"].includes(name))
    purgeInstanceCache(instance);
  return status;
};

// Convenience functions
export const toggleInstanceVisibility = async (instance: Instance["name"]) => {
  return await _toggleSpecifiedInstanceStatus(instance, "is_visible");
};
export const toggleInstanceSubmission = async (instance: Instance["name"]) => {
  return await _toggleSpecifiedInstanceStatus(instance, "submission_enabled");
};
export const toggleInstanceApproval = async (instance: Instance["name"]) => {
  return await _toggleSpecifiedInstanceStatus(instance, "approval_required");
};
export const toggleInstanceFlagging = async (instance: Instance["name"]) => {
  return await _toggleSpecifiedInstanceStatus(instance, "flagging_enabled");
};
export const toggleInstanceQueueOnFiltered = async (
  instance: Instance["name"],
) => {
  return await _toggleSpecifiedInstanceStatus(instance, "queue_on_filtered");
};

export const updateInstanceSuppliedFilter = async (
  instance: Instance["name"],
  filter: string,
) => {
  if (filter.length > config.instances.max_global_filter_length)
    throw new BadRequestError(
      "Provided filter character count is above global filter limit",
    );
  try {
    new RegExp(filter);
  } catch {
    throw new BadRequestError(
      "Provided regular expression for instance global filter is invalid",
    );
  }
  return await WRITER`UPDATE instances SET custom_filter = ${filter} WHERE name = ${instance}`;
};

export const updateInstanceQueueFlaggedThreshold = async (
  instance: Instance["name"],
  threshold: Instance["queue_flags_threshold"],
): Promise<void> => {
  if (Math.sign(threshold) === -1)
    throw new BadRequestError("Threshold must be positive");
  await WRITER`UPDATE instances SET queue_flags_threshold = ${threshold} WHERE name = ${instance}`;
};

// ip address blocking
export const toggleInstanceProxyBlacklist = async (
  instance: Instance["name"],
) => {
  return await _toggleSpecifiedInstanceStatus(
    instance,
    "blocklist_proxy_enabled",
  );
};
export const toggleInstanceVPNBlacklist = async (
  instance: Instance["name"],
) => {
  return await _toggleSpecifiedInstanceStatus(
    instance,
    "blocklist_vpn_enabled",
  );
};

export const toggleInstanceTorBlacklist = async (
  instance: Instance["name"],
) => {
  return await _toggleSpecifiedInstanceStatus(
    instance,
    "blocklist_tor_enabled",
  );
};

//#endregion TOGGLES

export const enableInstanceNotifications = async (
  instance: Instance["name"],
  url: string,
  service: string,
  DB = WRITER,
) => {
  if (!config.skybook.instance_notifications)
    throw new UnavailableError("Instance notification sending is disabled");
  if (!config.skybook.instance_notification_services.includes(service))
    throw new BadRequestError(
      "Specified notification endpoint is not supported by Skybook",
    );
  if (!notificationUrlIsValidForService(service, url))
    throw new BadRequestError(
      "Specified URL is not valid for provided service while attempting to enable instance notifications",
    );
  url = encryptedURL(url);
  await WRITER`UPDATE instances SET notification_endpoint=${url},notification_service=${service} WHERE name=${instance}`;
  await notifyUser(
    instance,
    null,
    "Notifications will now be sent to you when an entry is created on your guestbook!",
  );
};
export const disableInstanceNotifications = async (
  instance: Instance["name"],
  DB = WRITER,
) => {
  await DB`UPDATE instances SET notification_endpoint=null,notification_service=null WHERE name=${instance}`;
  return 0;
};

export const instanceNotificationInfo = async (
  instance: Instance["name"],
  DB = READER,
) => {
  const [info] =
    await DB`SELECT notification_endpoint,notification_service FROM instances WHERE name = ${instance}`;
  return info;
};
export const exportInstance = async (ctx: RequestContext) => {
  const entries =
    await READER`SELECT ${READER.unsafe(EXPORTABLE_COLUMN_NAMES.join(","))} FROM posts WHERE instance = ${ctx.instance}`;
  const header = EXPORTABLE_COLUMN_NAMES.join(",");
  let csv = EXPORTABLE_COLUMN_NAMES.join(",") + "\n";
  csv += entries
    .map((post: Post) =>
      [
        post.author,
        post.content,
        JSON.stringify(post.extra),
        post.reply,
        new Date(post.added).toISOString(),
      ]
        .map((v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`))
        .join(","),
    )
    .join("\n");
  return csv;
};
export const importInstance = async (
  instance: Instance["name"],
  entries: Mutable<Post>[],
) => {
  entries = entries.slice(0, 1000);
  let extraKeys: Set<string> = new Set([]);
  const currentFields =
    await READER`SELECT name FROM fields WHERE instance = ${instance} AND name NOT IN ('author', 'content');`;
  for (const { name: field } of currentFields) extraKeys.add(field);
  for (const entry of entries) {
    if ((entry.extra as unknown) == "{}") entry.extra = {};
    const inputFields = [
      "author",
      "content",
      ...Object.keys(entry.extra),
      "reply",
      "added",
    ];

    if (entry.extra) {
      for (const field of Object.keys(entry.extra)) {
        if (!extraKeys.has(field)) {
          extraKeys.add(field);
          await setField(instance, { name: field, is_required: false });
        }
      }
    }
    if (!entry.added) {
      entry.added = new Date(Date.now());
    } else {
      const p = !isNaN(Number(entry.added))
        ? new Date(Number(entry.added))
        : new Date(entry.added);
      entry.added = isNaN(p.getTime()) ? new Date() : p;
    }
    if (await allFieldsAreWritable(instance, Object.keys(entry.extra))) {
      const clearedEntry = {
        instance: instance,
        author: entry.author,
        content: entry.content,
        extra: entry.extra,
        reply: entry.reply,
        added: entry.added,
        ip_hash: "Added via import",
        can_flag: false,
        identifier: crypto.randomUUID(),
      };

      await WRITER`INSERT INTO posts ${WRITER(clearedEntry)}`;
    } else {
      throw new BadRequestError("Not all fields are writable");
    }
  }
  return { ok: true };
};
