/**
 * GitHub Pull Request Reviews API integration.
 * Posts inline comments on PR diff lines via a single review.
 */

import { type Finding, SEVERITY_EMOJI, SEVERITY_ORDER, type Severity, countBySeverity } from "../output/severity.js";

const MAX_INLINE_COMMENTS = 30;
const CODEGOAT_SIGNATURE = "<!-- codegoat-review -->";

export interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  token: string;
}

export interface DiffLine {
  file: string;
  line: number;
}

export interface InlineComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

/**
 * Parse diff lines from GitHub's PR files response.
 * Returns set of "file:line" strings that are commentable.
 */
export function parseDiffLines(files: Array<{ filename: string; patch?: string }>): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();

  for (const file of files) {
    if (!file.patch) continue;
    const lines = new Set<number>();
    let rightLine = 0;

    for (const line of file.patch.split("\n")) {
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        rightLine = parseInt(hunkMatch[1], 10);
        continue;
      }
      if (line.startsWith("-")) continue; // deleted line, no right-side line number
      if (line.startsWith("+") || line.startsWith(" ")) {
        lines.add(rightLine);
        rightLine++;
      }
    }

    result.set(file.filename, lines);
  }

  return result;
}

/**
 * Map findings to inline comments. Returns { inline, summary } split.
 */
export function mapFindings(
  findings: Finding[],
  diffLines: Map<string, Set<number>>,
  minSeverity: Severity = "warning"
): { inline: InlineComment[]; summary: Finding[] } {
  const inline: InlineComment[] = [];
  const summary: Finding[] = [];
  const minOrder = SEVERITY_ORDER[minSeverity];

  for (const f of findings) {
    if (SEVERITY_ORDER[f.severity] < minOrder) {
      summary.push(f);
      continue;
    }

    const fileLines = diffLines.get(f.file);
    if (!fileLines || !f.line) {
      summary.push(f);
      continue;
    }

    if (inline.length >= MAX_INLINE_COMMENTS) {
      summary.push(f);
      continue;
    }

    if (fileLines.has(f.line)) {
      inline.push({
        path: f.file,
        line: f.line,
        side: "RIGHT",
        body: `${SEVERITY_EMOJI[f.severity]} **${f.severity}** — ${f.message}`,
      });
    } else {
      // Find closest diff line
      const closest = findClosestLine(f.line, fileLines);
      if (closest !== null) {
        inline.push({
          path: f.file,
          line: closest,
          side: "RIGHT",
          body: `${SEVERITY_EMOJI[f.severity]} **${f.severity}** (related to line ${f.line}) — ${f.message}`,
        });
      } else {
        summary.push(f);
      }
    }
  }

  return { inline, summary };
}

function findClosestLine(target: number, lines: Set<number>): number | null {
  let closest: number | null = null;
  let minDist = Infinity;
  for (const l of lines) {
    const dist = Math.abs(l - target);
    if (dist < minDist) {
      minDist = dist;
      closest = l;
    }
  }
  // Only use if within 20 lines
  return closest !== null && minDist <= 20 ? closest : null;
}

function buildReviewBody(
  findings: Finding[],
  summaryFindings: Finding[],
  failOn: Severity | null
): string {
  const counts = countBySeverity(findings);
  const parts = (["critical", "warning", "info", "style"] as Severity[])
    .filter(s => counts[s] > 0)
    .map(s => `${SEVERITY_EMOJI[s]} ${counts[s]} ${s}`);

  let body = `${CODEGOAT_SIGNATURE}\n## 🐐 codegoat review\n\n${parts.join(" · ") || "✅ No issues found"}\n`;

  if (summaryFindings.length > 0) {
    body += "\n### Additional findings\n\n";
    for (const f of summaryFindings) {
      const loc = f.line ? ` (${f.file}:${f.line})` : f.file ? ` (${f.file})` : "";
      body += `- ${SEVERITY_EMOJI[f.severity]} **${f.severity}**${loc} — ${f.message}\n`;
    }
  }

  return body;
}

/**
 * Fetch PR files from GitHub API.
 */
async function fetchPRFiles(ctx: PRContext): Promise<Array<{ filename: string; patch?: string }>> {
  const url = `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.pullNumber}/files?per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${ctx.token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error(`GitHub API error fetching PR files: ${res.status} ${res.statusText}`);
  return res.json() as any;
}

/**
 * Dismiss previous codegoat reviews on the PR.
 */
async function dismissPreviousReviews(ctx: PRContext): Promise<void> {
  const url = `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.pullNumber}/reviews?per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${ctx.token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) return; // best effort

  const reviews: any[] = await res.json() as any;
  for (const review of reviews) {
    if (review.body?.includes(CODEGOAT_SIGNATURE) && review.state !== "DISMISSED") {
      try {
        await fetch(
          `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.pullNumber}/reviews/${review.id}/dismissals`,
          {
            method: "PUT",
            headers: { Authorization: `token ${ctx.token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Superseded by new codegoat review" }),
          }
        );
      } catch { /* best effort */ }
    }
  }
}

/**
 * Post a PR review with inline comments.
 */
export async function postPRReview(
  ctx: PRContext,
  findings: Finding[],
  options: { commentSeverity?: Severity; failOn?: Severity }
): Promise<{ posted: number; summary: number }> {
  const prFiles = await fetchPRFiles(ctx);
  const diffLines = parseDiffLines(prFiles);

  const commentSeverity = options.commentSeverity ?? "warning";
  const { inline, summary: summaryFindings } = mapFindings(findings, diffLines, commentSeverity);

  // Determine review event
  const maxSev = findings.length > 0
    ? findings.reduce((max, f) => SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[max] ? f.severity : max, "style" as Severity)
    : null;
  const failOn = options.failOn ?? "critical";
  const event = maxSev && SEVERITY_ORDER[maxSev] >= SEVERITY_ORDER[failOn]
    ? "REQUEST_CHANGES" : "COMMENT";

  const body = buildReviewBody(findings, summaryFindings, options.failOn ?? null);

  // Dismiss previous reviews
  await dismissPreviousReviews(ctx);

  // Post new review
  const url = `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.pullNumber}/reviews`;
  const payload: any = {
    commit_id: ctx.commitSha,
    event,
    body,
    comments: inline.map(c => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `token ${ctx.token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub API error posting review: ${res.status} ${res.statusText}\n${errBody}`);
  }

  return { posted: inline.length, summary: summaryFindings.length };
}

/**
 * Detect PR context from GitHub Actions environment.
 */
export function detectPRContext(): PRContext | null {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !eventPath || !repo) return null;

  try {
    const event = JSON.parse(require("node:fs").readFileSync(eventPath, "utf-8"));
    if (!event.pull_request) return null;

    const [owner, repoName] = repo.split("/");
    return {
      owner,
      repo: repoName,
      pullNumber: event.pull_request.number,
      commitSha: event.pull_request.head.sha,
      token,
    };
  } catch {
    return null;
  }
}
