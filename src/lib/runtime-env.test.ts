import assert from "node:assert/strict";
import { test } from "node:test";
import { hasDatabaseUrl, isNetlifyRuntime, useDocumentStore } from "./runtime-env.ts";

test("runtime-env: local preview is not Netlify", () => {
  assert.equal(hasDatabaseUrl(), false);
  assert.equal(isNetlifyRuntime(), false);
  assert.equal(useDocumentStore(), false);
});
