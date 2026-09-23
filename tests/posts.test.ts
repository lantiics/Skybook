import { ctx } from "./harness";
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
import { toggleInstanceSubmission } from "root/src/domain/instances";
import { READER, WRITER } from "root/src/db";
import {
  withSubmissionDisabled,
  withVisibilityDisabled,
} from "./instances.test";
export const createAnonymousPost = async () => {
  return await createPost(ctx.anonymous as RequestContext, {
    content: "test",
  });
};
export const createElevatedPost = async () => {
  return await createPost(ctx.elevated as RequestContext, { content: "test" });
};
describe("Post logic without valid credentials/elevated context", () => {
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
