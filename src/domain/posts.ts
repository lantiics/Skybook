import { sql } from "bun";
import {
  PUBLIC_COLUMN_NAMES,
  PRIVATE_COLUMN_NAMES,
  ADMIN_COLUMN_NAMES,
} from "../defaults.ts";
import {
  UnauthorizedError,
  FilteredError,
  NotFoundError,
  LockedError,
} from "../errors.ts";
import { RequestContext } from "../types/context.ts";
import { generateToken, entryTokenValid } from "./tokens.ts";
import { DB } from "../db.ts";
import {
  flaggingEnabled,
  replyingEnabled,
  instanceQueuesFilteredPosts,
  compiledInstanceStatus,
  isVisible,
  instanceHasRequesterBlocked,
  blockUser,
  unblockUser,
} from "./instances.ts";
import { Post } from "../types/entities.ts";
import { blockIpOnInstance, hashIp, unblockIpOnInstance } from "./ip.ts";
import { userCanBeBlocked } from "./users.ts";

const generateIdentifier = (): string => {
  const data = crypto.randomUUID() + crypto.randomUUID();
  const hasher = new Bun.CryptoHasher("sha512");
  hasher.update(btoa(data));
  const digest = hasher.digest("hex");
  return digest.slice(0, digest.length / 2);
};
const assertEntryCreationPossible = async (
  ctx: RequestContext,
  fields: Record<string, any>,
): Promise<boolean | 2> => {
  let instanceFields: Record<
    string,
    {
      special: boolean;
      public: boolean;
      required?: boolean;
      replacement?: string;
      filter?: string;
    }
  > = {
    parent: {
      special: false,
      public: true,
    },
    author: {
      special: false,
      public: true,
      required: true,
      replacement: "anonymous",
    },
    content: {
      special: false,
      public: true,
      required: true,
      filter: "arf|meow",
    },
  };
  const customFields =
    (await DB`SELECT * FROM fields WHERE instance = ${ctx.instance}`)[0] ?? {};
  if (Object.entries(customFields).length > 0) {
    instanceFields = { ...instanceFields, ...customFields };
  }
  if (
    !ctx.superAdmin &&
    !ctx.elevated &&
    (await instanceHasRequesterBlocked(
      ctx.instance,
      ctx.user?.identifier ?? "",
      hashIp(ctx.ip),
    ))
  ) {
    throw new UnauthorizedError("User is blocked by this instance");
  }

  if (fields?.extra) {
    for (const [field, config] of fields.extra) {
      fields[field] = config;
    }
    delete fields.extra;
  }
  if (fields?.parent) {
    if (
      !(
        await DB`SELECT can_reply FROM posts WHERE identifier = ${fields.parent} AND instance = ${ctx.instance}}`
      ).values()[0]
    ) {
      throw new UnauthorizedError("Cannot reply to this post");
    }
  }
  console.log(fields);
  for (const [field, content] of Object.entries(fields)) {
    // console.log(field, content, instanceFields[field]);
    if (field !== "content") {
      if (
        !instanceFields[field].public ||
        instanceFields[field].special ||
        (field === "parent" && !replyingEnabled(ctx.instance))
      ) {
        throw new UnauthorizedError("Unacceptable fields inputted");
      }
    }
    if (instanceFields[field]?.filter && !ctx.elevated && !ctx.superAdmin) {
      if (content.match(RegExp(instanceFields[field].filter))) {
        if (!(await instanceQueuesFilteredPosts(ctx.instance))) {
          throw new FilteredError("Entry contained filtered values");
        } else {
          return 2;
        }
      }
    }
  }
  return true;
};

export const createPost = async (
  ctx: RequestContext,
  fields: Record<string, string>,
) => {
  const foo = await assertEntryCreationPossible(ctx, fields);

  let isQueued: boolean = false;
  console.log(foo, "queue status");
  if (foo === 2) {
    isQueued = true;
  }
  const _token = generateToken();
  const identifier = crypto.randomUUID();

  fields.identifier = identifier;
  const entry: any = {
    identifier: identifier,
    instance: ctx.instance,
    is_queued: isQueued,
    author: fields.author !== "" ? fields.author : "anonymous",
    content: fields.content,
    ip_hash: hashIp(ctx.ip as string),
  };
  // / @ts-expect-error
  if (fields.parent) entry.parent = fields.parent;
  // /@ts-expect-error
  if (fields.extra) entry.extra = fields.extra;
  console.log(ctx);
  if (ctx.user?.name) {
    entry.authenticated_user_identifier = ctx.user.identifier;
  }
  console.log(entry);

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
  return { row, token: _token, wasQueued: isQueued };
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

  assertEntryCreationPossible(ctx, fields);
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
) => {
  if (!(await postCanBeBlocked(ctx, identifier)))
    throw new UnauthorizedError("Creator of post is unable to be blocked");
  const [postData] =
    await DB`SELECT ip_hash,authenticated_user_identifier FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;

  await blockUser(ctx.instance, postData.authenticated_user_identifier);
  await blockIpOnInstance(ctx.instance, postData.ip_hash);
};
export const unblockPostCreator = async (
  ctx: RequestContext,
  identifier: string,
) => {
  const [postData] =
    await DB`SELECT ip_hash,authenticated_user_identifier FROM posts WHERE identifier = ${identifier} AND instance = ${ctx.instance}`;
  await unblockUser(ctx.instance, postData.authenticated_user_identifier);
  await unblockIpOnInstance(ctx.instance, postData.ip_hash);
};
export const _getPostStatus = async (
  instance: string,
  identifier: string,
  property: string,
) => {
  const [status] =
    await DB`SELECT ${DB(property)} FROM posts WHERE identifier = ${identifier} AND instance = ${instance}`;
  console.log(status);
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
export const flagPost = async (ctx: RequestContext, identifier: string) => {
  if (
    (await flaggingEnabled(ctx.instance)).status &&
    (await postIsVisible(ctx.instance, identifier)) &&
    !(await postIsQueued(ctx.instance, identifier)) &&
    (await postFlaggingEnabled(ctx.instance, identifier))
  ) {
    return await _updatePost(ctx, identifier, "flag_count = flag_count + 1");
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
  return await _updatePost(ctx, identifier, "approved = 1");
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
  return await _updatePost(ctx, identifier, "flag_count = 0");
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
  if (!(await isVisible(ctx.instance)).status && !ctx.elevated) {
    throw new UnauthorizedError("");
  }

  // in Posts.get()
  console.log(ctx.elevated, "elevation");
  const additionalRequirements = ctx.elevated
    ? DB``
    : DB`AND is_visible AND NOT is_queued`;
  const order = ctx.elevated
    ? DB`flag_count DESC, is_queued DESC,seq DESC`
    : DB`is_pinned DESC, seq DESC`;

  const entries =
    await DB`SELECT ${!ctx.superAdmin ? (!ctx.elevated ? DB.unsafe([...PUBLIC_COLUMN_NAMES].join(",")) : DB.unsafe([...PRIVATE_COLUMN_NAMES].join(","))) : DB`*`} FROM posts WHERE parent IS NULL AND instance = ${ctx.instance}  ${additionalRequirements} ORDER BY ${order} LIMIT ${perPage} OFFSET ${page * perPage} `;
  console.log(ctx, "context");
  const postIdentifiers = entries
    .filter((post: Post) => post.identifier)
    .map((post: Post) => post.identifier);

  const postReplies =
    await DB`SELECT ${!ctx?.superAdmin ? (!ctx?.elevated ? DB.unsafe([...PUBLIC_COLUMN_NAMES].join(",")) : DB.unsafe([...PRIVATE_COLUMN_NAMES].join(","))) : "*"} FROM posts WHERE parent IN (${postIdentifiers}) AND instance = ${ctx.instance} `;
  const pageToReturn = [...entries, ...postReplies];
  for (const post of pageToReturn) {
    if (post.authenticated_user_identifier) {
      post.authenticated_user_name = (
        await DB`SELECT name FROM users WHERE identifier = ${post.authenticated_user_identifier}`
      )[0].name;
    }
  }
  return pageToReturn;
};

export const countPosts = (ctx: RequestContext) => {
  const filter = ctx.elevated ? "" : "WHERE NOT isQueued AND isVisible";
  return DB`SELECT COUNT(*) FROM posts WHERE instance = ${ctx.instance}  ${filter}`;
};
