import { ctx, generateUser } from "./harness";
import { test, expect, describe } from "bun:test";
import {
  createPost,
  deletePost,
  editPost,
  flagPost,
  getPosts,
} from "@domain/posts";
import { RequestContext } from "@/types/context";
import { UnauthorizedError } from "@/errors";
import { READER, WRITER } from "root/src/db";
import {
  withSubmissionDisabled,
  withVisibilityDisabled,
} from "./instances.test";
import { hashIp } from "root/src/domain/ip";
export const createAnonymousPost = async () => {
  return await createPost(ctx.anonymous as RequestContext, {
    content: "test",
  });
};
export const createPostWithRandomizedIP = async () => {
  const c = ctx.anonymous;
  c.ip = crypto.randomUUID();
  return await createPost(c as RequestContext, {
    content: "test",
  });
};
export const createAuthorizedPost = async () => {
  return await createPost(ctx.authorized as RequestContext, {
    content: "test",
  });
};
export const createElevatedPost = async () => {
  return await createPost(ctx.elevated as RequestContext, { content: "test" });
};
describe("Post logic without valid credentials", () => {
  test("Trying to delete a post with invalid credentials fails", async () => {
    const identifier = (await createAnonymousPost()).row.identifier;

    expect(
      deletePost(ctx.anonymous as RequestContext, identifier),
    ).rejects.toThrow(UnauthorizedError);
  });

  test("Trying to alter a post with invalid credentials fails", async () => {
    const identifier = (await createAnonymousPost()).row.identifier;

    expect(
      editPost(ctx.anonymous as RequestContext, identifier, {
        content: "meow",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  test("Trying to get posts on an invisible instance without an elevated context fails", async () => {
    expect(
      withVisibilityDisabled(async () => await getPosts(ctx.anonymous, 0)),
    ).rejects.toThrow(UnauthorizedError);
  });

  test("Trying to flag a post which cannot be flagged without elevated context fails", async () => {
    const identifier = (await createElevatedPost()).row.identifier; // Elevated posts are always unflaggable, so we can simply use one of them

    expect(flagPost(ctx.anonymous, identifier)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  test("Trying to post to an instance with submission disabled fails", async () => {
    expect(
      withSubmissionDisabled(async () => await createAnonymousPost()),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("Post logic with valid token", () => {
  test("Trying to delete a post with a valid token succeeds", async () => {
    const { row, token } = await createAnonymousPost();
    const identifier = row.identifier;
    const tokenCtx = { ...ctx.anonymous, token };
    expect(deletePost(tokenCtx, identifier)).resolves.toBeUndefined();
  });
  test("Trying to alter a post with a valid token succeeds", async () => {
    const { row, token } = await createAnonymousPost();
    const identifier = row.identifier;
    const tokenCtx = { ...ctx.anonymous, token };
    expect(
      editPost(tokenCtx, identifier, { content: "hello" }),
    ).resolves.toBeUndefined();
  });
});

describe("Post logic with elevated context", () => {
  test("Trying to flag a post which cannot be flagged with elevated context fails", async () => {
    const identifier = (await createElevatedPost()).row.identifier; // Elevated posts are always unflaggable, so we can simply use one of them

    expect(flagPost(ctx.elevated, identifier)).rejects.toThrow(
      UnauthorizedError,
    );
  });
  test("Trying to post to an instance with submission disabled as an elevated user succeeds", async () => {
    expect(
      withSubmissionDisabled(async () => await createElevatedPost()),
    ).resolves.toBeDefined();
  });

  test("Trying to delete any post as an elevated user succeeds", async () => {
    const identifier = (await createAnonymousPost()).row.identifier;

    expect(
      deletePost(ctx.elevated as RequestContext, identifier),
    ).resolves.toBeUndefined();
  });

  test("Trying to alter any post as an elevated user succeeds", async () => {
    const identifier = (await createAnonymousPost()).row.identifier;

    expect(
      editPost(ctx.elevated as RequestContext, identifier, {
        content: "meow",
      }),
    ).resolves.toBeUndefined();
  });
});

test("Post flags exceeding flag threshold automatically queues a post", async () => {
  const identifier = (await createAnonymousPost()).row.identifier;
  await WRITER`UPDATE posts SET flag_count = 2 WHERE identifier = ${identifier}`;
  await flagPost(ctx.anonymous, identifier);
  const [post] =
    await READER`SELECT is_queued FROM posts WHERE identifier = ${identifier}`;
  expect(post.is_queued).toBeTrue();
});

test("Global blocks on one user do not affect all other users", async () => {
  const alice = await generateUser();
  const bob = await generateUser();

  await WRITER`INSERT INTO instance_blocks (instance, ip_hash, user_identifier) VALUES (${alice.name}, ${hashIp(alice.ip)}, ${alice.identifier})`;

  const [{ count: aliceCount }] = await WRITER`
    SELECT COUNT(*) FROM instance_blocks
    WHERE ip_hash = ${hashIp(alice.ip)} OR user_identifier = ${alice.identifier}
  `;
  const [{ count: bobCount }] = await WRITER`
    SELECT COUNT(*) FROM instance_blocks
    WHERE ip_hash = ${hashIp(bob.ip)} OR user_identifier = ${bob.identifier}
  `;

  expect(Number(aliceCount)).toBe(1);
  expect(Number(bobCount)).toBe(0);
});
