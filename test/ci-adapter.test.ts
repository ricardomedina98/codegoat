import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { detectCIPlatform, detectCIContext } from "../src/ci/adapter.js";

describe("detectCIPlatform", () => {
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    origEnv.GITLAB_CI = process.env.GITLAB_CI;
    origEnv.GITHUB_ACTIONS = process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    if (origEnv.GITLAB_CI !== undefined) process.env.GITLAB_CI = origEnv.GITLAB_CI;
    else delete process.env.GITLAB_CI;
    if (origEnv.GITHUB_ACTIONS !== undefined) process.env.GITHUB_ACTIONS = origEnv.GITHUB_ACTIONS;
    else delete process.env.GITHUB_ACTIONS;
  });

  it("returns null when no CI env detected", () => {
    assert.equal(detectCIPlatform(), null);
  });

  it("detects GitHub Actions", () => {
    process.env.GITHUB_ACTIONS = "true";
    assert.equal(detectCIPlatform(), "github");
  });

  it("detects GitLab CI", () => {
    process.env.GITLAB_CI = "true";
    assert.equal(detectCIPlatform(), "gitlab");
  });

  it("prefers GitLab when both are set", () => {
    process.env.GITLAB_CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    assert.equal(detectCIPlatform(), "gitlab");
  });
});

describe("detectCIContext — GitLab", () => {
  const envKeys = ["GITLAB_CI", "GITLAB_TOKEN", "CI_JOB_TOKEN", "CI_PROJECT_ID", "CI_MERGE_REQUEST_IID", "CI_COMMIT_SHA", "CI_API_V4_URL"];
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) { origEnv[k] = process.env[k]; delete process.env[k]; }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (origEnv[k] !== undefined) process.env[k] = origEnv[k];
      else delete process.env[k];
    }
  });

  it("returns GitLab context when all env vars present", () => {
    process.env.GITLAB_CI = "true";
    process.env.GITLAB_TOKEN = "glpat-xxx";
    process.env.CI_PROJECT_ID = "12345";
    process.env.CI_MERGE_REQUEST_IID = "42";
    process.env.CI_COMMIT_SHA = "abc123";
    process.env.CI_API_V4_URL = "https://gitlab.example.com/api/v4";

    const ctx = detectCIContext("gitlab");
    assert.ok(ctx);
    assert.equal(ctx.platform, "gitlab");
    assert.equal(ctx.token, "glpat-xxx");
    assert.equal(ctx.repo, "12345");
    assert.equal(ctx.mergeRequestId, 42);
    assert.equal(ctx.commitSha, "abc123");
    assert.equal(ctx.apiUrl, "https://gitlab.example.com/api/v4");
  });

  it("falls back to CI_JOB_TOKEN", () => {
    process.env.GITLAB_CI = "true";
    process.env.CI_JOB_TOKEN = "job-token";
    process.env.CI_PROJECT_ID = "123";
    process.env.CI_MERGE_REQUEST_IID = "1";
    process.env.CI_COMMIT_SHA = "def456";

    const ctx = detectCIContext("gitlab");
    assert.ok(ctx);
    assert.equal(ctx.token, "job-token");
    assert.equal(ctx.apiUrl, "https://gitlab.com/api/v4"); // default
  });

  it("returns null when missing required vars", () => {
    process.env.GITLAB_CI = "true";
    process.env.GITLAB_TOKEN = "glpat-xxx";
    // Missing CI_PROJECT_ID
    process.env.CI_MERGE_REQUEST_IID = "1";
    process.env.CI_COMMIT_SHA = "abc";

    const ctx = detectCIContext("gitlab");
    assert.equal(ctx, null);
  });
});
