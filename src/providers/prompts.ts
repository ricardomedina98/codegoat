import type { ChatMessage } from "./types.js";

const SYSTEM_PROMPT =
  "You are a senior code reviewer. Be direct and specific. " +
  "Flag real issues, skip praise. Categorize each issue as " +
  "Bug, Security, Performance, Style, or Clarity. " +
  "Always reference the file name and line number.";

function addLineNumbers(content: string): string {
  return content
    .split("\n")
    .map((line, i) => `${i + 1} | ${line}`)
    .join("\n");
}

export function buildReviewPrompt(
  files: Array<{ path: string; content: string }>
): ChatMessage[] {
  const fileBlocks = files
    .map((f) => `=== ${f.path} ===\n${addLineNumbers(f.content)}`)
    .join("\n\n");

  const userContent =
    fileBlocks +
    "\n\n" +
    "Review the code above. For each issue found, format as:\n\n" +
    "### <filepath>\n\n" +
    "- **<Category> (line <N>):** <description>\n\n" +
    "End with a summary line: '<N> issues found: <breakdown by category>'. " +
    "If the code looks good, say so briefly.";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}
