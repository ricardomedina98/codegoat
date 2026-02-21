/**
 * Bitbucket PR Comments API adapter for inline comments.
 * Uses the Bitbucket REST API 2.0 to post inline comments on PR diffs.
 */

import type { CIAdapter, CIContext, PostReviewOptions, PostReviewResult } from "./adapter.js";
import { type Finding, type Severity, SEVERITY_EMOJI, SEVERITY_ORDER, countBySeverity } from "../output/severity.js";
import { parseDiffLines, mapFindings } from "../github/pr-review.js";

const CODEGOAT_SIGNATURE = "<!-- codegoat-review -->";
const MAX_INLINE_COMMENTS = 30;
const API_BASE = "https://api.bitbucket.org/2.0";

/**
 * Fetch PR diff from Bitbucket API.
 */
async function fetchPRDiff(
  repo: string,
  prId: number,
  token: string
): Promise<Array<{ filename: string; patch?: string }>> {
  const url = `${API_BASE}/repositories/${repo}/pullrequests/${prId}/diffstat?pagelen=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Bitbucket API error (diffstat): ${res.status}`);
  const data: any = await res.json();

  // Fetch actual diff for patch content
  const diffUrl = `${API_BASE}/repositories/${repo}/pullrequests/${prId}/diff`;
  const diffRes = await fetch(diffUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!diffRes.ok) throw new Error(`Bitbucket API error (diff): ${diffRes.status}`);
  const rawDiff = await diffRes.text();

  // Parse unified diff into per-file patches
  return parseUnifiedDiff(rawDiff);
}

/**
 * Parse a unified diff string into per-file patches.
 */
export function parseUnifiedDiff(rawDiff: string): Array<{ filename: string; patch?: string }> {
  const files: Array<{ filename: string; patch?: string }> = [];
  const fileSections = rawDiff.split(/^diff --git /m).slice(1);

  for (const section of fileSections) {
    const headerMatch = section.match(/^a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;
    const filename = headerMatch[2];

    // Extract the patch (everything after the first @@ line, including it)
    const patchStart = section.indexOf("@@");
    if (patchStart === -1) {
      files.push({ filename });
      continue;
    }
    files.push({ filename, patch: section.slice(patchStart) });
  }

  return files;
}

/**
 * Delete previous codegoat comments on the PR.
 */
async function deletePreviousComments(
  repo: string,
  prId: number,
  token: string
): Promise<void> {
  try {
    const url = `${API_BASE}/repositories/${repo}/pullrequests/${prId}/comments?pagelen=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: any = await res.json();

    for (const comment of data.values ?? []) {
      if (comment.content?.raw?.includes(CODEGOAT_SIGNATURE)) {
        try {
          await fetch(
            `${API_BASE}/repositories/${repo}/pullrequests/${prId}/comments/${comment.id}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
          );
        } catch { /* best effort */ }
      }
    }
  } catch { /* best effort */ }
}

/**
 * Post a comment on a Bitbucket PR (inline or general).
 */
async function postComment(
  repo: string,
  prId: number,
  token: string,
  body: string,
  inline?: { path: string; to: number }
): Promise<boolean> {
  const payload: any = {
    content: { raw: body },
  };
  if (inline) {
    payload.inline = { path: inline.path, to: inline.to };
  }

  const res = await fetch(
    `${API_BASE}/repositories/${repo}/pullrequests/${prId}/comments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return res.ok;
}

export const bitbucketAdapter: CIAdapter = {
  async postReview(ctx, findings, options): Promise<PostReviewResult> {
    const repo = ctx.repo; // workspace/repo-slug format
    const prId = ctx.mergeRequestId;
    const commentSeverity = options.commentSeverity ?? "warning";

    // Fetch PR diff
    const prFiles = await fetchPRDiff(repo, prId, ctx.token);
    const diffLines = parseDiffLines(prFiles);

    // Map findings
    const { inline, summary } = mapFindings(findings, diffLines, commentSeverity);

    // Delete previous codegoat comments
    await deletePreviousComments(repo, prId, ctx.token);

    // Post summary comment
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
    await postComment(repo, prId, ctx.token, summaryBody);

    // Post inline comments
    let posted = 0;
    for (const comment of inline.slice(0, MAX_INLINE_COMMENTS)) {
      const ok = await postComment(repo, prId, ctx.token, comment.body, {
        path: comment.path,
        to: comment.line,
      });
      if (ok) posted++;
    }

    return { posted, summary: summary.length };
  },
};
