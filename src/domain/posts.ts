import {
  PUBLIC_COLUMN_NAMES,
  PRIVATE_COLUMN_NAMES,
  SYSTEM_COLUMN_NAMES,
} from "../defaults.ts";
import {
  UnauthorizedError,
  FilteredError,
  NotFoundError,
  LockedError,
  BadRequestError,
} from "../errors.ts";
import { RequestContext } from "../types/context.ts";
import { generateToken, entryTokenValid } from "./tokens.ts";
import { READER, WRITER } from "../db.ts";
import {
  flaggingEnabled,
  compiledInstanceStatus,
  isVisible,
  instanceHasRequesterBlocked,
  instanceIpBlocks,
  instanceSuppliedFilter,
  InstanceQueueFlaggedThreshold,
} from "./instances.ts";
import { Field, Post } from "../types/entities.ts";
import { hashIp, ipSource } from "./ip.ts";
import { userCanBeBlocked, userCanPost } from "./users.ts";
import { config } from "../config.ts";
import { tryGlobalBlock } from "./enforcements.ts";
import { purgeInstanceCache } from "./cache.ts";
import { notifyUser } from "./notifications.ts";

const fieldIsFiltered = (field: string, filter: RegExp): boolean => {
  if (filter.test(field)) return true;
  return false;
};
const validatedEntry = async (
  ctx: RequestContext,
  fields: Record<string, any>,
  isEdit: boolean = false,
): Promise<Record<string, unknown>> => {
  // console.time("Validated entry");
  const instanceStatus = await compiledInstanceStatus(ctx.instance);
  if (!instanceStatus.submission_enabled.status && !ctx.elevated)
    throw new UnauthorizedError("Submission is disabled");

  const instanceBlocks = await instanceIpBlocks(ctx.instance);
  if (!ctx.ip.startsWith("harness")) {
    const source = await ipSource(ctx.ip);
    if (instanceBlocks.proxy) {
      if (source === "proxy") throw new UnauthorizedError("IP blocked");
    }
    if (instanceBlocks.vpn) {
      if (source === "vpn") throw new UnauthorizedError("IP blocked");
    }
    if (instanceBlocks.tor) {
      if (source === "tor") throw new UnauthorizedError("IP blocked");
    }
  }
  if (
    (await instanceHasRequesterBlocked(
      ctx.instance,
      hashIp(ctx.ip),
      ctx.user?.identifier,
    )) ||
    (ctx.user?.identifier && !(await userCanPost(ctx.user.identifier)))
  ) {
    throw new UnauthorizedError("User blocked");
  }

  let instanceFields: Record<string, Omit<Field, "instance">> = {
    author: {
      name: "author",
      is_special: false,
      is_public: true,
      is_required: true,
      replacement: "anonymous",
      filter: null,
    },
    content: {
      name: "content",
      is_special: false,
      is_public: true,
      is_required: true,
      replacement: null,
      filter: null,
    },
  };
  for (const [name, field] of Object.entries(fields)) {
    if (field === "") delete fields[name];
  }

  const fieldFilter = await instanceSuppliedFilter(ctx.instance);

  const cF =
    (await READER`SELECT name, is_special, is_public, is_required, replacement, filter FROM fields WHERE instance = ${ctx.instance}`) as Field[];

  const customFields = Object.fromEntries(cF.map((v) => [v.name, v]));

  instanceFields = { ...instanceFields, ...customFields };

  let entry: Partial<Post> = {
    is_queued: instanceStatus.approval_required.status,
  };
  if (fieldFilter) {
    const filter = new RegExp(fieldFilter, "ig");
    if (Object.values(fields).some((field) => filter.test(field))) {
      if (instanceStatus.queue_on_filtered.status) {
        entry.is_queued = true;
      } else {
        throw new FilteredError(
          "At least one field violated the instance's global filter",
        );
      }
    }
  }

  // throwing if required fields cannot be set
  for (const [_, field] of Object.entries(instanceFields)) {
    if (field.is_required && !fields[field.name]) {
      if (!isEdit) {
        if (field.replacement === "") {
          throw new BadRequestError(
            "Required field has no replacement and is not specified",
          );
        }
        fields[field.name] = field.replacement;
      } else {
        if ([null, ""].includes(fields[field.name])) {
          if (!field.replacement)
            throw new BadRequestError(
              "Required field is not specified and has no default",
            );
          fields[field.name] = field.replacement;
        }
      }
    }

    if (field["filter"] && fields[field.name]) {
      if (fieldIsFiltered(fields[field.name], new RegExp(field["filter"]))) {
        if (instanceStatus.queue_on_filtered.status) {
          entry.is_queued = true;
        } else {
          throw new FilteredError("At least one field was filtered");
        }
      }
    }
  }
  const validFields = new Set(Object.keys(instanceFields));
  let extra: Record<string, string> = {};
  for (const [field, content] of Object.entries(fields)) {
    if (field === "author" && content.length > config.fields.author_max_length)
      throw new FilteredError("Field length is above limit");
    else if (content.length > config.fields.typical_max_length)
      throw new FilteredError("Field length is above limit");
    if (!["author", "content"].includes(field)) {
      if (!validFields.has(field))
        throw new BadRequestError(
          "At least one specified field does not exist",
        );
      delete fields[field];
      extra[field] = content;
    }
  }
  fields.extra = extra;
  entry = { ...entry, ...fields };
  // console.timeEnd("Validated entry");
  return entry;
};

export const replyToPost = async (
  ctx: RequestContext,
  identifier: string,
  message: string,
) => {
  await WRITER`UPDATE posts SET reply = ${message} WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  purgeInstanceCache(ctx.instance);
};
export const createPost = async (
  ctx: RequestContext,
  fields: Record<string, string>,
) => {
  let entry = await validatedEntry(ctx, fields);

  const _token = generateToken();
  const identifier = crypto.randomUUID();

  fields.identifier = identifier;
  entry = {
    ...entry,
    identifier: identifier,
    instance: ctx.instance,
    ip_hash: hashIp(ctx.ip as string),
    can_flag: !ctx.elevated,
  };

  if (ctx.user?.name) {
    entry.authenticated_user_identifier = ctx.user.identifier;
  }

  const columns = ctx.superAdmin
    ? [
        ...PRIVATE_COLUMN_NAMES,
        ...PUBLIC_COLUMN_NAMES,
        ...SYSTEM_COLUMN_NAMES,
      ].join(",")
    : (ctx.elevated
        ? [...PRIVATE_COLUMN_NAMES]
        : [...PUBLIC_COLUMN_NAMES]
      ).join(",");

  const row = await WRITER.begin(async (tx) => {
    const [row] =
      await tx`INSERT INTO posts ${tx(entry)} RETURNING ${tx.unsafe(columns)}`;
    await tx`
  INSERT INTO tokens (instance, identifier, token, created_at, expires_at)
  VALUES (${entry.instance},  ${row.identifier}, ${_token}, NOW(), (NOW() + INTERVAL '2 days'))
`;

    return row;
  });

  if (!entry.is_queued) purgeInstanceCache(ctx.instance);
  await notifyUser(ctx.instance, row);
  return { row, token: _token, wasQueued: entry.is_queued };
};

export const editPost = async (
  ctx: RequestContext,
  identifier: string,
  fields: Record<string, string | undefined>,
) => {
  if (!(await entryTokenValid(ctx, identifier))) {
    throw new UnauthorizedError(
      "Not authorized to alter entry with identifier " + identifier,
    );
  }
  if (!ctx.superAdmin) {
    if (await _getPostStatus(ctx.instance, identifier, "sys_lock")) {
      throw new LockedError(
        "Attempted to update a locked post without system-level privileges",
      );
    }
  }

  const extra: Record<string, string | undefined> = {};

  Object.keys(fields).forEach((key) => {
    if (!["content", "author"].includes(key)) {
      extra[key] = fields[key];
      delete fields[key];
    }
  });
  const columns = ctx.superAdmin
    ? `*`
    : (ctx.elevated
        ? [...PRIVATE_COLUMN_NAMES]
        : [...PUBLIC_COLUMN_NAMES]
      ).join(",");
  fields.last_edited_by = ctx.user?.identifier;

  const hasExtra = Object.keys(extra).length > 0;
  const hasFields = Object.keys(fields).length > 0;

  const row = await WRITER`
    UPDATE posts
    SET ${hasFields ? WRITER(fields) : WRITER``}
    ${hasFields && hasExtra ? WRITER`,` : WRITER``}
    ${
      hasExtra
        ? WRITER`extra = COALESCE(extra, '{}'::jsonb) || ${extra}::jsonb`
        : WRITER``
    }
    WHERE identifier = ${identifier} AND instance = ${ctx.instance}
    RETURNING ${WRITER.unsafe(columns)}
  `;
  if (!row.is_queued && row.is_visible) purgeInstanceCache(ctx.instance);
  return;
};
export const deletePost = async (ctx: RequestContext, identifier: string) => {
  if (!ctx.elevated) {
    if (!(await entryTokenValid(ctx, identifier))) {
      throw new UnauthorizedError(
        "Not authorized to specified delete entry with provided credentials",
      );
    }
  }
  if (!ctx.superAdmin) {
    if (await _getPostStatus(ctx.instance, identifier, "sys_lock")) {
      throw new LockedError(
        "Attempted to update a locked post without system-level privileges",
      );
    }
  }
  const post = await WRITER.begin(async (tx) => {
    const [post] =
      await tx`DELETE FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance} RETURNING is_queued, is_visible`;
    await tx`DELETE FROM tokens WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
    return post;
  });
  if (!post.is_queued && post.is_visible) purgeInstanceCache(ctx.instance);
};

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
/* 
  TODO:
        Queue every post made by the blocked creator. If using a user identifier, we don't use a time limit. If there is only
        a hashed IP address attached, we queue every post made by that IP addresses within the past 60 days 
        in order to to account for IP address changes.
*/
export const blockPostCreator = async (
  ctx: RequestContext,
  identifier: string,
  reason?: string,
) => {
  if (!(await postCanBeBlocked(ctx, identifier)))
    throw new UnauthorizedError("Creator of post is unable to be blocked");
  const [postData] =
    await READER`SELECT ip_hash,authenticated_user_identifier FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  await WRITER.begin(async (tx) => {
    await tx`INSERT INTO instance_blocks (instance, ip_hash, user_identifier, reason) VALUES (${ctx.instance},${postData.ip_hash},${postData.user_identifier},${reason})`;
    const [{ count: blockCount }] =
      await tx`SELECT COUNT(*) FROM instance_blocks WHERE ip_hash = ${postData.ip_hash} OR user_identifier = ${postData.authenticated_user_identifier}`;
    await tryGlobalBlock(postData.ip_hash, blockCount, tx);
  });
};
export const unblockPostCreator = async (
  ctx: RequestContext,
  identifier: string,
) => {
  const [postData] =
    await READER`SELECT ip_hash,authenticated_user_identifier FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  await WRITER`DELETE FROM instance_blocks WHERE instance = ${ctx.instance} AND (user_identifier = ${postData.identifier} OR ip_hash = ${postData.ip_hash})`;
};
export const _getPostStatus = async (
  instance: string,
  identifier: string,
  property: string,
) => {
  const [status] =
    await READER`SELECT ${READER(property)} FROM posts WHERE identifier = ${identifier} AND instance = ${instance}`;
  return status[property];
};
export const _updatePost = async (
  ctx: RequestContext,
  identifier: string,
  property: string,
) => {
  const columns = ctx.superAdmin
    ? `*`
    : (ctx.elevated
        ? [...PRIVATE_COLUMN_NAMES]
        : [...PUBLIC_COLUMN_NAMES]
      ).join(",");
  if (!ctx.superAdmin) {
    if (await _getPostStatus(ctx.instance, identifier, "sys_lock")) {
      throw new LockedError(
        "Attempted to update a locked post without system-level privileges",
      );
    }
  }
  if (
    [
      "is_visible",
      "is_queued",
      "flagging_enabled",
      "is_pinned",
      "is_highlighted",
      "can_block",
      "sys_lock",
    ].includes(property)
  ) {
    purgeInstanceCache(ctx.instance);
  }
  return (
    await WRITER`UPDATE posts SET ${WRITER.unsafe(property)} WHERE identifier = ${identifier} AND instance = ${ctx.instance} returning ${WRITER.unsafe(columns)}`
  )[0];
};
export const postFlaggedByRequestor = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await READER`SELECT EXISTS (SELECT 1 FROM post_flags WHERE instance = ${ctx.instance} AND identifier = ${identifier} AND
   (
    ${ctx.user?.identifier ? `user_identifier = ${ctx.user.identifier} OR ip_hash = ${hashIp(ctx.ip)}` : `ip_hash = ${hashIp(ctx.ip)}`} 
   ))`;
};
export const flagPost = async (ctx: RequestContext, identifier: string) => {
  if (
    (await flaggingEnabled(ctx.instance)).status &&
    (await postIsVisible(ctx.instance, identifier)) &&
    !(await postIsQueued(ctx.instance, identifier)) &&
    (await postFlaggingEnabled(ctx.instance, identifier))
  ) {
    const queueFlagsThreshold = (
      await InstanceQueueFlaggedThreshold(ctx.instance)
    ).status;
    return await WRITER.begin(async (tx) => {
      await tx`INSERT INTO post_flags (instance, identifier, user_identifier, ip_hash) VALUES (${ctx.instance}, ${identifier}, ${ctx.user?.identifier}, ${hashIp(ctx.ip)});`;
      const [{ flag_count: flagCount }] =
        await tx`UPDATE posts SET flag_count = flag_count + 1 WHERE instance = ${ctx.instance} AND identifier = ${identifier} RETURNING flag_count`;
      if (flagCount >= queueFlagsThreshold) {
        await tx`UPDATE posts SET is_queued = true WHERE instance = ${ctx.instance} AND identifier = ${identifier}`;
        purgeInstanceCache(ctx.instance);
      }
    });
  }
  throw new UnauthorizedError(
    "Flagging is disabled on either the specified post or instance",
  );
};

export const postIsVisible = async (instance: string, identifier: string) => {
  return await _getPostStatus(instance, identifier, "is_visible");
};
export const postIsQueued = async (instance: string, identifier: string) => {
  return await _getPostStatus(instance, identifier, "is_queued");
};
export const postFlaggingEnabled = async (
  instance: string,
  identifier: string,
) => {
  return await _getPostStatus(instance, identifier, "can_flag");
};

export const postCanBeBlocked = async (
  ctx: RequestContext,
  identifier: string,
) => {
  if (!identifier) {
    throw new NotFoundError("No identifier specified");
  }
  const [post] =
    await READER`SELECT authenticated_user_identifier,can_block FROM posts WHERE identifier = ${identifier}`;
  if (
    post.authenticated_user_identifier &&
    post.authenticated_user_identifier !== ctx.user?.identifier
  ) {
    if (!(await userCanBeBlocked(post.authenticated_user_identifier)))
      return false;
  } else if (
    post.authenticated_user_identifier &&
    post.authenticated_user_identifier === ctx.user?.identifier
  ) {
    return false;
  }

  return post.can_block;
};

export const togglePostPin = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await _updatePost(ctx, identifier, "is_pinned = NOT is_pinned");
};
export const togglePostHighlight = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await _updatePost(
    ctx,
    identifier,
    "is_highlighted = NOT is_highlighted",
  );
};
export const approvePost = async (ctx: RequestContext, identifier: string) => {
  return await _updatePost(ctx, identifier, "is_queued = false");
};
export const togglePostFlagging = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await _updatePost(ctx, identifier, "can_flag = NOT can_flag");
};
export const clearPostFlags = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await WRITER.begin(async (tx) => {
    await tx`DELETE FROM post_flags WHERE instance = ${ctx.instance} AND identifier = ${identifier}`;
    await tx`UPDATE posts SET flag_count = 0 WHERE instance = ${ctx.instance} AND identifier = ${identifier}`;
  });
};

export const togglePostVisibility = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await _updatePost(ctx, identifier, "is_visible = NOT is_visible");
};

export const lockPostMethods = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await _updatePost(ctx, identifier, "sys_lock = NOT sys_lock");
};

export const getPosts = async (
  ctx: RequestContext,
  page: number,
  perPage: number = 15,
) => {
  if (!ctx.elevated && !(await isVisible(ctx.instance)).status) {
    throw new UnauthorizedError("This instance is not visible");
  }

  const additionalRequirements = ctx.elevated
    ? READER.unsafe("")
    : READER`AND  ((NOT is_queued AND is_visible) OR (authenticated_user_identifier IS NOT NULL AND authenticated_user_identifier = ${ctx.user?.identifier}))`;
  const order = ctx.elevated
    ? READER.unsafe(
        "block_count DESC, is_pinned DESC, is_queued DESC, flag_count DESC, seq DESC",
      )
    : READER.unsafe("is_pinned DESC,is_queued DESC, is_visible ASC, seq DESC");
  let columnList = ctx.superAdmin
    ? "*"
    : (ctx.elevated
        ? [...PRIVATE_COLUMN_NAMES]
        : [...PUBLIC_COLUMN_NAMES]
      ).join(",");
  if (ctx.elevated) {
    columnList = columnList.replace("ip_hash", "posts.ip_hash");
    columnList = columnList.replace("instance", "posts.instance");
    columnList += ",instance_blocks.reason AS block_reason";
    columnList += `,(
    SELECT COUNT(*)
    FROM instance_blocks ib
    WHERE ib.instance = posts.instance
    AND (ib.ip_hash = posts.ip_hash OR ib.user_identifier = posts.authenticated_user_identifier)
    ) AS block_count`;
  }
  const query = ctx.elevated
    ? READER`LEFT JOIN instance_blocks
      ON posts.instance = instance_blocks.instance
      AND (posts.ip_hash = instance_blocks.ip_hash OR posts.authenticated_user_identifier = instance_blocks.user_identifier)
    WHERE posts.instance = ${ctx.instance}`
    : READER`WHERE instance = ${ctx.instance}`;
  const entries = await READER`SELECT ${READER.unsafe(columnList)} FROM posts
      ${query}
    ${additionalRequirements}
    ORDER BY ${order} LIMIT ${perPage} OFFSET ${page * perPage}`;

  return entries;
};

export const pageCount = async (ctx: RequestContext) => {
  const posts = await countPosts(ctx);
  const pages = Math.floor(posts / config.posts.perPage);
  return pages;
};

export const countPosts = async (ctx: RequestContext) => {
  const filter = ctx.elevated ? "" : "AND NOT is_queued AND is_visible";
  console.log(
    await READER`SELECT COUNT(*) FROM posts WHERE instance = ${ctx.instance} ${READER.unsafe(filter)}`,
    "this the countttt",
  );
  return (
    await READER`SELECT COUNT(*) FROM posts WHERE instance = ${ctx.instance}  ${READER.unsafe(filter)}`
  )[0].count;
};
