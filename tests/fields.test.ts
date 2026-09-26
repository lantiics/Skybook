import { test, expect } from "bun:test";
import { ctx } from "./harness";
import { setField, renameField, deleteField } from "@domain/fields";
import { createPost } from "@/domain/posts";
import { RequestContext } from "@/types/context";
import { READER } from "@/db";
import { BadRequestError } from "root/src/errors";

test("Renaming a field migrates existing extra keys on posts", async () => {
  await setField(ctx.anonymous.instance, { name: "old", is_required: false });
  const createdPost = await createPost(ctx.anonymous as RequestContext, {
    content: "meow",
    old: "meow",
  });
  await renameField(ctx.anonymous as RequestContext, "old", "new");
  const [post] =
    await READER`SELECT extra FROM posts WHERE instance = ${ctx.anonymous.instance} AND identifier = ${createdPost.row.identifier}`;
  expect(post.extra).toEqual({ new: "meow" });
});

test("Deleting a field removes applicable extra keys from posts", async () => {
  await setField(ctx.anonymous.instance, {
    name: "willDelete",
    is_required: false,
  });
  const createdPost = await createPost(ctx.anonymous as RequestContext, {
    content: "meow",
    willDelete: "meow",
  });
  await deleteField(ctx.anonymous.instance, "willDelete");
  const [post] =
    await READER`SELECT extra FROM posts WHERE instance = ${ctx.anonymous.instance} AND identifier = ${createdPost.row.identifier}`;
  expect(post.extra.willDelete).toBeUndefined();
});

test("Submitting a post with a non-existent field name does not suceed", async () => {
  expect(
    createPost(ctx.anonymous, { content: "test", nonExistentField: "test" }),
  ).rejects.toThrow(BadRequestError);

  expect(
    createPost(ctx.elevated, { content: "test", nonExistentField: "test" }),
  ).rejects.toThrow(BadRequestError);
});
