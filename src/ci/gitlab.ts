/**
 * GitLab MR Discussions API adapter for inline comments.
 * Uses the Discussions API to batch-post inline comments on MR diffs.
 */

import type { CIAdapter, CIContext, PostReviewOptions, PostReviewResult } from "./adapter.js";
import { type Finding, type Severity, SEVERITY_EMOJI, SEVERITY_ORDER, countBySeverity } from "../output/severity.js";
import { parseDiffLines, mapFindings } from "../github/pr-review.js";

const CODEGOAT_SIGNATURE = "<!-- codegoat-review -->";
const MAX_INLINE_COMMENTS = 30;

interface GitLabDiffRef {
  base_sha: string;
  head_sha: string;
  start_sha: string;
}

/**
 * Fetch MR diff metadata and changed files from GitLab API.
 */
async function fetchMRDiffs(
  apiUrl: string,
  projectId: string,
  mrIid: number,
  token: string
): Promise<{ diffRefs: GitLabDiffRef; files: Array<{ new_path: string; diff: string }> }> {
  // Get MR info for diff refs
  const mrRes = await fetch(`${apiUrl}/projects/${projectId}/merge_requests/${mrIid}`, {
    headers: { "PRIVATE-TOKEN": token },
  });
  if (!mrRes.ok) throw new Error(`GitLab API error (MR info): ${mrRes.status}`);
  const mrData: any = await mrRes.json();
  const diffRefs: GitLabDiffRef = mrData.diff_refs;

  // Get MR diffs (changes)
  const diffsRes = await fetch(`${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/diffs?per_page=100`, {
    headers: { "PRIVATE-TOKEN": token },
  });
  if (!diffsRes.ok) throw new Error(`GitLab API error (MR diffs): ${diffsRes.status}`);
  const diffs: any[] = await diffsRes.json();

  return {
    diffRefs,
    files: diffs.map((d: any) => ({ new_path: d.new_path, diff: d.diff })),
  };
}

/**
 * Delete previous codegoat discussions on the MR.
 */
async function deletePreviousDiscussions(
  apiUrl: string,
  projectId: string,
  mrIid: number,
  token: string
): Promise<void> {
  try {
    const res = await fetch(
      `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/discussions?per_page=100`,
      { headers: { "PRIVATE-TOKEN": token } }
    );
    if (!res.ok) return;
    const discussions: any[] = await res.json();

    for (const disc of discussions) {
      if (disc.notes?.[0]?.body?.includes(CODEGOAT_SIGNATURE)) {
        try {
          await fetch(
            `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/discussions/${disc.id}`,
            { method: "DELETE", headers: { "PRIVATE-TOKEN": token } }
          );
        } catch { /* best effort */ }
      }
    }
  } catch { /* best effort */ }
}

/**
 * Post a single discussion (inline or general) on a GitLab MR.
 */
async function postDiscussion(
  apiUrl: string,
  projectId: string,
  mrIid: number,
  token: string,
  body: string,
  position?: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
    new_path: string;
    new_line: number;
    position_type: "text";
  }
): Promise<boolean> {
  const payload: any = { body };
  if (position) payload.position = position;

  const res = await fetch(
    `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/discussions`,
    {
      method: "POST",
      headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return res.ok;
}

export const gitlabAdapter: CIAdapter = {
  async postReview(ctx, findings, options): Promise<PostReviewResult> {
    const apiUrl = ctx.apiUrl ?? "https://gitlab.com/api/v4";
    const projectId = encodeURIComponent(ctx.repo);
    const mrIid = ctx.mergeRequestId;
    const commentSeverity = options.commentSeverity ?? "warning";

    // Fetch MR diffs
    const { diffRefs, files } = await fetchMRDiffs(apiUrl, projectId, mrIid, ctx.token);

    // Convert GitLab diffs to the same format our parseDiffLines expects
    const ghStyleFiles = files.map(f => ({ filename: f.new_path, patch: f.diff }));
    const diffLines = parseDiffLines(ghStyleFiles);

    // Map findings
    const { inline, summary } = mapFindings(findings, diffLines, commentSeverity);

    // Delete previous codegoat discussions
    await deletePreviousDiscussions(apiUrl, projectId, mrIid, ctx.token);

    // Post summary discussion first
    const counts = countBySeverity(findings);
    const parts = (["critical", "warning", "info", "style"] as Severity[])
      .filter(s => counts[s] > 0)
      .map(s => `${SEVERITY_EMOJI[s]} ${counts[s]} ${s}`);

    let summaryBody = `${CODEGOAT_SIGNATURE}\n## 🐐 codegoat review\n\n${parts.join(" · ") || "✅ No issues found"}\n`;
    if (summary.length > 0) {
      summaryBody += "\n### Additional findings\n\n";
      for (const f of summary) {
        const loc = f.line ? ` (${f.file}:${f.line})` : f.file ? ` (${f.file})` : "";
        summaryBody += `- ${SEVERITY_EMOJI[f.severity]} **${f.severity}**${loc} — ${f.message}\n`;
      }
    }
    await postDiscussion(apiUrl, projectId, mrIid, ctx.token, summaryBody);

    // Post inline discussions (GitLab: each inline comment is a separate discussion)
    let posted = 0;
    for (const comment of inline.slice(0, MAX_INLINE_COMMENTS)) {
      const ok = await postDiscussion(apiUrl, projectId, mrIid, ctx.token, comment.body, {
        base_sha: diffRefs.base_sha,
        head_sha: diffRefs.head_sha,
        start_sha: diffRefs.start_sha,
        new_path: comment.path,
        new_line: comment.line,
        position_type: "text",
      });
      if (ok) posted++;
    }

    return { posted, summary: summary.length };
  },
};
