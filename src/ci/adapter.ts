/**
 * Shared CI platform adapter interface.
 * Abstracts inline comment posting across GitHub, GitLab, Bitbucket, etc.
 */

import type { Finding, Severity } from "../output/severity.js";

export interface CIContext {
  platform: "github" | "gitlab" | "bitbucket";
  token: string;
  /** Repo identifier (owner/repo for GitHub, project ID for GitLab) */
  repo: string;
  /** PR/MR number */
  mergeRequestId: number;
  /** HEAD commit SHA */
  commitSha: string;
  /** Base API URL (for self-hosted instances) */
  apiUrl?: string;
}

export interface PostReviewResult {
  posted: number;   // inline comments posted
  summary: number;  // findings in summary body
}

export interface PostReviewOptions {
  commentSeverity?: Severity;
  failOn?: Severity;
}

export interface CIAdapter {
  /** Post a review with inline comments */
  postReview(
    ctx: CIContext,
    findings: Finding[],
    options: PostReviewOptions
  ): Promise<PostReviewResult>;
}

/**
 * Auto-detect CI platform from environment variables.
 */
export function detectCIPlatform(): "github" | "gitlab" | "bitbucket" | null {
  if (process.env.GITLAB_CI) return "gitlab";
  if (process.env.BITBUCKET_PIPELINE_UUID) return "bitbucket";
  if (process.env.GITHUB_ACTIONS) return "github";
  return null;
}

/**
 * Auto-detect full CI context from environment.
 */
export function detectCIContext(override?: string): CIContext | null {
  const platform = (override as any) ?? detectCIPlatform();
  if (!platform) return null;

  if (platform === "github") {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!token || !repo || !eventPath) return null;

    try {
      const event = JSON.parse(require("node:fs").readFileSync(eventPath, "utf-8"));
      if (!event.pull_request) return null;
      return {
        platform: "github",
        token,
        repo,
        mergeRequestId: event.pull_request.number,
        commitSha: event.pull_request.head.sha,
      };
    } catch { return null; }
  }

  if (platform === "gitlab") {
    const token = process.env.GITLAB_TOKEN ?? process.env.CI_JOB_TOKEN;
    const projectId = process.env.CI_PROJECT_ID;
    const mrIid = process.env.CI_MERGE_REQUEST_IID;
    const commitSha = process.env.CI_COMMIT_SHA;
    const apiUrl = process.env.CI_API_V4_URL ?? "https://gitlab.com/api/v4";

    if (!token || !projectId || !mrIid || !commitSha) return null;

    return {
      platform: "gitlab",
      token,
      repo: projectId,
      mergeRequestId: parseInt(mrIid, 10),
      commitSha,
      apiUrl,
    };
  }

  if (platform === "bitbucket") {
    const token = process.env.BITBUCKET_TOKEN;
    const workspace = process.env.BITBUCKET_WORKSPACE;
    const repoSlug = process.env.BITBUCKET_REPO_SLUG;
    const prId = process.env.BITBUCKET_PR_ID;
    const commitSha = process.env.BITBUCKET_COMMIT;

    if (!token || !workspace || !repoSlug || !prId || !commitSha) return null;

    return {
      platform: "bitbucket",
      token,
      repo: `${workspace}/${repoSlug}`,
      mergeRequestId: parseInt(prId, 10),
      commitSha,
    };
  }

  return null;
}
