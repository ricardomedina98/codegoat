import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { detectCIPlatform, detectCIContext } from "../src/ci/adapter.js";
import { parseUnifiedDiff } from "../src/ci/bitbucket.js";

describe("Bitbucket detection", () => {
  const envKeys = ["BITBUCKET_PIPELINE_UUID", "BITBUCKET_TOKEN", "BITBUCKET_WORKSPACE", "BITBUCKET_REPO_SLUG", "BITBUCKET_PR_ID", "BITBUCKET_COMMIT", "GITLAB_CI", "GITHUB_ACTIONS"];
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => { for (const k of envKeys) { origEnv[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of envKeys) { if (origEnv[k] !== undefined) process.env[k] = origEnv[k]; else delete process.env[k]; } });

  it("detects Bitbucket Pipelines", () => {
    process.env.BITBUCKET_PIPELINE_UUID = "{abc-123}";
    assert.equal(detectCIPlatform(), "bitbucket");
  });

  it("returns full context when all vars present", () => {
    process.env.BITBUCKET_PIPELINE_UUID = "{abc}";
    process.env.BITBUCKET_TOKEN = "app-pw-xxx";
    process.env.BITBUCKET_WORKSPACE = "myteam";
    process.env.BITBUCKET_REPO_SLUG = "myrepo";
    process.env.BITBUCKET_PR_ID = "17";
    process.env.BITBUCKET_COMMIT = "sha456";

    const ctx = detectCIContext("bitbucket");
    assert.ok(ctx);
    assert.equal(ctx.platform, "bitbucket");
    assert.equal(ctx.token, "app-pw-xxx");
    assert.equal(ctx.repo, "myteam/myrepo");
    assert.equal(ctx.mergeRequestId, 17);
    assert.equal(ctx.commitSha, "sha456");
  });

  it("returns null when missing token", () => {
    process.env.BITBUCKET_PIPELINE_UUID = "{abc}";
    process.env.BITBUCKET_WORKSPACE = "myteam";
    process.env.BITBUCKET_REPO_SLUG = "myrepo";
    process.env.BITBUCKET_PR_ID = "1";
    process.env.BITBUCKET_COMMIT = "sha";
    // Missing BITBUCKET_TOKEN

    const ctx = detectCIContext("bitbucket");
    assert.equal(ctx, null);
  });
});

describe("parseUnifiedDiff", () => {
  it("parses a unified diff into per-file patches", () => {
    const rawDiff = `diff --git a/src/app.ts b/src/app.ts
index abc..def 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;
 export {};
diff --git a/src/util.ts b/src/util.ts
index ghi..jkl 100644
--- a/src/util.ts
+++ b/src/util.ts
@@ -5,3 +5,4 @@
 function foo() {}
+function bar() {}
 export { foo };
`;
    const files = parseUnifiedDiff(rawDiff);
    assert.equal(files.length, 2);
    assert.equal(files[0].filename, "src/app.ts");
    assert.ok(files[0].patch?.includes("const y = 2"));
    assert.equal(files[1].filename, "src/util.ts");
    assert.ok(files[1].patch?.includes("function bar"));
  });

  it("handles binary files without patch", () => {
    const rawDiff = `diff --git a/image.png b/image.png
Binary files differ
`;
    const files = parseUnifiedDiff(rawDiff);
    assert.equal(files.length, 1);
    assert.equal(files[0].filename, "image.png");
    assert.equal(files[0].patch, undefined);
  });

  it("returns empty for empty diff", () => {
    assert.deepEqual(parseUnifiedDiff(""), []);
  });
});
