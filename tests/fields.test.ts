import { test, expect } from "bun:test";
import { ctx, harnessUserName, tx } from "./harness";
import { setField, renameField, deleteField } from "@domain/fields";
import { createPost } from "root/src/domain/posts";
import { RequestContext } from "root/src/types/context";
import { READER } from "@/db";

test("Renaming a field migrates existing extra keys on posts", async () => {
  await setField(harnessUserName, { name: "old", is_required: false });
  const createdPost = await createPost(ctx.anonymous as RequestContext, {
    content: "meow",
    old: "meow",
  });
  await renameField(ctx.anonymous as RequestContext, "old", "new");
  const [post] =
    await READER`SELECT extra FROM posts WHERE instance = ${harnessUserName} AND identifier = ${createdPost.row.identifier}`;
  expect(post.extra).toEqual({ new: "meow" });
});

test("Deleting a field removes applicable extra keys from posts", async () => {
  await setField(harnessUserName, { name: "willDelete", is_required: false });
  const createdPost = await createPost(ctx.anonymous as RequestContext, {
    content: "meow",
    willDelete: "meow",
  });
  await deleteField(harnessUserName, "willDelete");
  const [post] =
    await READER`SELECT extra FROM posts WHERE instance = ${harnessUserName} AND identifier = ${createdPost.row.identifier}`;
  expect(post.extra.willDelete).toBeUndefined();
});
