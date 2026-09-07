import { sql } from "bun";
import {
  PUBLIC_COLUMN_NAMES,
  PRIVATE_COLUMN_NAMES,
  ADMIN_COLUMN_NAMES,
  RESERVED_COLUMN_NAMES,
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
import { DB } from "../db.ts";
import {
  flaggingEnabled,
  // replyingEnabled,
  instanceQueuesFilteredPosts,
  compiledInstanceStatus,
  isVisible,
  instanceHasRequesterBlocked,
  blockUser,
  unblockUser,
  instanceIpBlocks,
  instanceSuppliedFilter,
  instanceDefaultFilters,
} from "./instances.ts";
import { Field, Post } from "../types/entities.ts";
import {
  blockIpOnInstance,
  hashIp,
  ipSource,
  unblockIpOnInstance,
} from "./ip.ts";
import { userCanBeBlocked, userCanPost } from "./users.ts";
import { config } from "../config.ts";

const generateIdentifier = (): string => {
  const data = crypto.randomUUID() + crypto.randomUUID();
  const hasher = new Bun.CryptoHasher("sha512");
  hasher.update(btoa(data));
  const digest = hasher.digest("hex");
  return digest.slice(0, digest.length / 2);
};
const fieldIsFiltered = (field: string, filter: RegExp): boolean => {
  if (filter.test(field)) return true;
  return false;
};
const validatedEntry = async (
  ctx: RequestContext,
  fields: Record<string, any>,
  isEdit: boolean = false,
): Promise<Record<string, unknown>> => {
  console.time("Validated entry");
  const instanceStatus = await compiledInstanceStatus(ctx.instance);
  if (!instanceStatus.submission_enabled.status && !ctx.elevated)
    throw new UnauthorizedError("Submission is disabled");

  const instanceBlocks = await instanceIpBlocks(ctx.instance);
  const source = await ipSource(ctx.ip);
  if (instanceBlocks.proxy) {
    if (source === "vpn") throw new UnauthorizedError("IP blocked");
  }
  if (instanceBlocks.vpn) {
    if (source === "vpn") throw new UnauthorizedError("IP blocked");
  }
  if (instanceBlocks.tor) {
    if (source === "tor") throw new UnauthorizedError("IP blocked");
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
    parent: {
      name: "parent",
      is_special: false,
      is_public: true,
      is_required: false,
      replacement: null,
      filter: null,
    },
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
  const defaultFilter = await instanceDefaultFilters(ctx.instance);
  const globalFilter = [...(fieldFilter || []), ...(defaultFilter || [])].join(
    "|",
  );
  console.log({
    "instance-supplied filter": fieldFilter,
    "default, kaiju-provided filter the instance has enabled": defaultFilter,
    "combined, which is what we check against": globalFilter,
  });

  const cF =
    await DB`SELECT name, is_special, is_public, is_required, replacement, filter FROM fields WHERE instance = ${ctx.instance}`;
  const customFields = Object.fromEntries(cF.map((v) => [v.name, v]));

  instanceFields = { ...instanceFields, ...customFields };

  if (
    !Object.entries(fields).every(([name, _]) =>
      Object.keys(instanceFields).includes(name),
    )
  )
    throw new BadRequestError("At least one field specified does not exist");

  let entry: Partial<Post> = {
    is_queued: instanceStatus.approval_required.status,
  };
  console.log(globalFilter);
  if (globalFilter) {
    const filter = new RegExp(globalFilter);
    if (Object.values(fields).some((field) => filter.test(field))) {
      if (instanceStatus.queue_on_filtered.status) {
        entry.is_queued = true;
      } else {
        throw new FilteredError(
          "At least one field violated the instance's global filter",
        );
      }
      console.log(
        "one or more of these fields were filtered: \n" +
          JSON.stringify(fields, null, 2),
      );
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
      }
    } else if (field.is_required && !fields[field.name] && isEdit) {
      if (!field.replacement)
        throw new BadRequestError(
          "Required field is not specified and has no default",
        );
      fields[field.name] = field.replacement;
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
  let extra = [];
  for (const [field, content] of Object.entries(fields)) {
    if (field === "author" && content.length > config.fields.author_max_length)
      throw new FilteredError("Field length is above limit");
    else if (content.length > config.fields.typical_max_length)
      throw new FilteredError("Field length is above limit");
    if (!["author", "parent", "content"].includes(field)) {
      delete fields[field];
      extra.push([field, content]);
    }
  }
  fields.extra = extra;
  entry = { ...entry, ...fields };
  console.timeEnd("Validated entry");
  return entry;
};
export const replyToPost = async (
  ctx: RequestContext,
  identifier: string,
  message: string,
) => {
  await DB`UPDATE posts SET reply = ${message} WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
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
  };

  if (ctx.user?.name) {
    entry.authenticated_user_identifier = ctx.user.identifier;
    entry.can_flag = false; // //
  }

  const columns = ctx.superAdmin
    ? [
        ...PRIVATE_COLUMN_NAMES,
        ...PUBLIC_COLUMN_NAMES,
        ...ADMIN_COLUMN_NAMES,
      ].join(",")
    : (ctx.elevated
        ? [...PRIVATE_COLUMN_NAMES]
        : [...PUBLIC_COLUMN_NAMES]
      ).join(",");

  const row = await DB.begin(async (tx) => {
    const [row] =
      await tx`INSERT INTO posts ${DB(entry)} RETURNING ${DB.unsafe(columns)}`;
    await tx`
  INSERT INTO tokens (instance, identifier, token, created_at, expires_at)
  VALUES (${entry.instance},  ${row.identifier}, ${_token}, NOW(), (NOW() + INTERVAL '2 days'))
`;
    return row;
  });
  return { row, token: _token, wasQueued: entry.is_queued };
};

export const editPost = async (
  ctx: RequestContext,
  identifier: string,
  fields: Record<string, string | null>,
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
  Object.keys(fields).forEach((key) => {
    if (!["content", "parent", "author"].includes(key)) {
      fields.extra = [[key, fields[key]]];
      delete fields[key];
    }
  });
  await validatedEntry(ctx, fields, true);
  const [currentMetadata] =
    await DB`SELECT authenticated_user_identifier FROM posts WHERE identifier = ${identifier}`;
  const columns = ctx.superAdmin
    ? `*`
    : (ctx.elevated
        ? [...PRIVATE_COLUMN_NAMES]
        : [...PUBLIC_COLUMN_NAMES]
      ).join(",");
  const row =
    await DB`UPDATE posts SET ${DB(fields)} WHERE identifier = ${identifier} AND instance = ${ctx.instance}  RETURNING ${DB.unsafe(columns)}`;

  return row;
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
  await DB.begin(async (tx) => {
    await tx`DELETE FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance} `;
    await tx`DELETE FROM tokens WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  });
};

export const blockPostCreator = async (
  ctx: RequestContext,
  identifier: string,
  reason?: string,
) => {
  if (!(await postCanBeBlocked(ctx, identifier)))
    throw new UnauthorizedError("Creator of post is unable to be blocked");
  const [postData] =
    await DB`SELECT ip_hash,authenticated_user_identifier FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  await DB.begin(async (tx) => {
    await tx`INSERT INTO instance_blocks (instance, ip_hash, user_identifier, reason) VALUES (${ctx.instance},${postData.ip_hash},${postData.user_identifier},${reason})`;
    // await tx``;
  });
  // if (postData.authenticated_user_identifier) {
  //   await blockUser(
  //     ctx.instance,
  //     postData.authenticated_user_identifier,
  //     reason,
  //   );
  // }
  // await blockIpOnInstance(ctx.instance, postData.ip_hash, reason);
};
export const unblockPostCreator = async (
  ctx: RequestContext,
  identifier: string,
) => {
  const [postData] =
    await DB`SELECT ip_hash,authenticated_user_identifier FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  await DB`DELETE FROM instance_blocks WHERE instance = ${ctx.instance} AND (user_identifier = ${postData.identifier} OR ip_hash = ${postData.ip_hash})`;
};
export const _getPostStatus = async (
  instance: string,
  identifier: string,
  property: string,
) => {
  const [status] =
    await DB`SELECT ${DB(property)} FROM posts WHERE identifier = ${identifier} AND instance = ${instance}`;
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
  return (
    await DB`UPDATE posts SET ${DB.unsafe(property)} WHERE identifier = ${identifier} AND instance = ${ctx.instance} returning ${DB.unsafe(columns)}`
  )[0];
};
export const postFlaggedByRequestor = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await DB`SELECT EXISTS (SELECT 1 FROM post_flags WHERE instance = ${ctx.instance} AND identifier = ${identifier} AND
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
    return await DB.begin(async (tx) => {
      await tx`INSERT INTO post_flags (instance, identifier, user_identifier, ip_hash) VALUES (${ctx.instance}, ${identifier}, ${ctx.user?.identifier}, ${hashIp(ctx.ip)});`;
      await tx`UPDATE posts SET flag_count = flag_count + 1 WHERE instance = ${ctx.instance} AND identifier = ${identifier}`;
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
    await DB`SELECT authenticated_user_identifier,can_block FROM posts WHERE identifier = ${identifier}`;
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
  return await DB.begin(async (tx) => {
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
export const togglePostReplying = async (
  ctx: RequestContext,
  identifier: string,
) => {
  return await _updatePost(ctx, identifier, "can_reply = NOT can_reply");
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
    ? DB.unsafe("")
    : DB`AND is_visible AND NOT is_queued`;
  const order = ctx.elevated
    ? DB.unsafe(
        "block_count DESC, is_pinned DESC, is_queued DESC, flag_count DESC, seq DESC",
      )
    : DB.unsafe("is_pinned DESC, seq DESC");
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
    ? DB`LEFT JOIN instance_blocks
      ON posts.instance = instance_blocks.instance
      AND (posts.ip_hash = instance_blocks.ip_hash OR posts.authenticated_user_identifier = instance_blocks.user_identifier)
    WHERE posts.instance = ${ctx.instance}`
    : DB`WHERE instance = ${ctx.instance}`;
  const entries = await DB`SELECT ${DB.unsafe(columnList)} FROM posts
      ${query}
    ${additionalRequirements}
    ORDER BY ${order} LIMIT ${perPage} OFFSET ${page * perPage}`;

  // const pageToReturn = [...entries];
  // const authorIds = [
  //   ...new Set(
  //     pageToReturn.map((p) => p.authenticated_user_identifier).filter(Boolean),
  //   ),
  // ];
  // const authors = authorIds.length
  //   ? await DB`SELECT identifier, name FROM users WHERE identifier IN ${DB(authorIds)}`
  //   : [];
  // const nameById = new Map(
  //   authors.map((a: Record<string, string>) => [a.identifier, a.name]),
  // );

  // for (const post of pageToReturn) {
  //   if (post.authenticated_user_identifier) {
  //     post.authenticated_user_name = nameById.get(
  //       post.authenticated_user_identifier,
  //     );
  //   }
  // }
  // const postsById = new Map();

  // for (const post of pageToReturn) {
  //   post.replies = [];
  //   postsById.set(post.identifier, post);
  // }

  // const rootPosts = [];

  // for (const post of pageToReturn) {
  //   if (post.parent === null) {
  //     rootPosts.push(post);
  //   } else {
  //     const parent = postsById.get(post.parent);
  //     post.added = new Date(post.added).toUTCString();

  //     if (parent) {
  //       parent.replies.push(post);
  //     }
  //   }
  // }

  return entries;
};

export const countPosts = async (ctx: RequestContext) => {
  const filter = ctx.elevated ? "" : "AND NOT is_queued AND is_visible";
  console.log(
    await DB`SELECT COUNT(*) FROM posts WHERE instance = ${ctx.instance} ${DB.unsafe(filter)}`,
    "this the countttt",
  );
  return (
    await DB`SELECT COUNT(*) FROM posts WHERE instance = ${ctx.instance}  ${DB.unsafe(filter)}`
  )[0].count;
};
