import type { ChatMessage } from "./types.js";

// === Review Prompts ===

const REVIEW_SYSTEM_PROMPT =
  "You are a senior code reviewer. Be direct and specific. Flag real issues, skip praise. " +
  "Always reference the file name and line number. " +
  "For each finding, assign exactly one severity level:\n" +
  "- critical: Bugs that will cause crashes, data loss, or security vulnerabilities in production. Only use for issues that WILL break things.\n" +
  "- warning: Likely problems — incomplete error handling, missing edge cases, deprecated APIs, potential race conditions.\n" +
  "- info: Improvement suggestions — better naming, simpler approach, unnecessary complexity.\n" +
  "- style: Cosmetic — formatting, naming conventions, import order.\n" +
  "Be conservative with critical. When in doubt between two levels, choose the lower one.";

function addLineNumbers(content: string): string {
  return content
    .split("\n")
    .map((line, i) => `${i + 1} | ${line}`)
    .join("\n");
}

function formatRulesBlock(rules?: string[]): string {
  if (!rules || rules.length === 0) return "";
  const rulesList = rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return `\n\nProject-specific rules to check:\n${rulesList}`;
}

export function buildReviewPrompt(
  files: Array<{ path: string; content: string }>,
  rules?: string[]
): ChatMessage[] {
  const fileBlocks = files
    .map((f) => `=== ${f.path} ===\n${addLineNumbers(f.content)}`)
    .join("\n\n");

  const userContent =
    fileBlocks +
    "\n\n" +
    "Review the code above. For each issue found, format as:\n\n" +
    "### <filepath>\n\n" +
    "- **<Severity> (line <N>):** <description>\n\n" +
    "Where Severity is one of: critical, warning, info, style.\n" +
    "End with a summary line: '<N> issues found: <breakdown by severity>'. " +
    "If the code looks good, say so briefly.";

  return [
    { role: "system", content: REVIEW_SYSTEM_PROMPT + formatRulesBlock(rules) },
    { role: "user", content: userContent },
  ];
}

// === Diff Review Prompts ===

const DIFF_REVIEW_SYSTEM_PROMPT =
  "You are a senior code reviewer reviewing a changeset (diff). " +
  "Focus on what the changes introduce: new bugs, security risks, missing error handling, regressions. " +
  "Lines marked [changed] are new/modified — focus your review there. " +
  "Lines marked [context] are existing code shown for understanding. " +
  "Be direct and specific. Reference file names and line numbers. " +
  "For each finding, assign exactly one severity level:\n" +
  "- critical: Bugs that will cause crashes, data loss, or security vulnerabilities. Only for issues that WILL break things.\n" +
  "- warning: Likely problems — incomplete error handling, missing edge cases, deprecated APIs.\n" +
  "- info: Improvement suggestions — better naming, simpler approach, unnecessary complexity.\n" +
  "- style: Cosmetic — formatting, naming conventions, import order.\n" +
  "Be conservative with critical.";

export function buildDiffReviewPrompt(
  files: Array<{ path: string; content: string; linesAdded: number; linesRemoved: number }>,
  totalAdded: number,
  totalRemoved: number,
  rules?: string[]
): ChatMessage[] {
  const fileBlocks = files
    .map((f) => `=== ${f.path} (+${f.linesAdded} -${f.linesRemoved}) ===\n${f.content}`)
    .join("\n\n");

  const userContent =
    `This changeset modifies ${files.length} files (+${totalAdded} -${totalRemoved} lines).\n\n` +
    fileBlocks +
    "\n\n" +
    "Review the changes above. Focus on [changed] lines. For each issue found, format as:\n\n" +
    "### <filepath>\n\n" +
    "- **<Category> (line <N>):** <description>\n\n" +
    "Start with a brief summary of what this changeset does (1-2 sentences).\n" +
    "End with: '<N> issues found: <breakdown by category>'. If the changes look good, say so briefly.";

  return [
    { role: "system", content: DIFF_REVIEW_SYSTEM_PROMPT + formatRulesBlock(rules) },
    { role: "user", content: userContent },
  ];
}

// === Docs Prompts ===

export type DocsLevel = "project" | "file" | "function";

const DOCS_SYSTEM_PROMPTS: Record<DocsLevel, string> = {
  project:
    "You are a technical writer generating project documentation. " +
    "Write a clear, accurate README-style summary of this codebase. " +
    "Describe what the project does, its architecture, key modules, and how they connect. " +
    "Be specific about actual functionality — do not write generic boilerplate. " +
    "Use markdown formatting.",
  file:
    "You are a technical writer generating per-file documentation. " +
    "For each file, write a brief summary of its purpose, its exports, and how it fits in the project. " +
    "Be specific and accurate. Do not repeat the code — describe what it does and why. " +
    "Use markdown formatting with a section per file.",
  function:
    "You are a technical writer generating function-level documentation. " +
    "For each exported/public function, class, or interface, write documentation comments in the appropriate format: " +
    "JSDoc/TSDoc for TypeScript/JavaScript, docstrings for Python, godoc comments for Go. " +
    "Include: a one-line summary, parameter descriptions, return description, and any important notes. " +
    "Be precise about types and behavior. Output as markdown code blocks showing the doc comments.",
};

const DOCS_USER_SUFFIXES: Record<DocsLevel, string> = {
  project:
    "Based on the code above, write a project overview document in markdown. Include:\n\n" +
    "1. **What this project does** (one paragraph)\n" +
    "2. **Architecture** (how the code is organized, key modules)\n" +
    "3. **Key components** (brief description of each major file/module)\n" +
    "4. **Data flow** (how data moves through the system)\n\n" +
    "Be specific to this actual codebase. No generic filler.",
  file:
    "For each file shown above, write documentation in this format:\n\n" +
    "### `<filepath>`\n\n" +
    "**Purpose:** <what this file does>\n\n" +
    "**Exports:** <list of exported items with brief descriptions>\n\n" +
    "**Dependencies:** <what it imports and why>\n\n" +
    "Cover every file. Be specific.",
  function:
    "For each exported function, class, and interface in the code above, " +
    "generate documentation comments (JSDoc/TSDoc for JS/TS, docstrings for Python, godoc for Go). Format as:\n\n" +
    "### `<filepath>` — `<exportName>`\n\n" +
    "```typescript\n" +
    "/**\n * <description>\n * @param <name> - <description>\n * @returns <description>\n */\n" +
    "```\n\n" +
    "Cover every export. Be precise about types and behavior.",
};

export function buildDocsPrompt(
  files: Array<{ path: string; content: string }>,
  level: DocsLevel
): ChatMessage[] {
  const fileBlocks = files
    .map((f) => `=== ${f.path} ===\n${f.content}`)
    .join("\n\n");

  const userContent = fileBlocks + "\n\n" + DOCS_USER_SUFFIXES[level];

  return [
    { role: "system", content: DOCS_SYSTEM_PROMPTS[level] },
    { role: "user", content: userContent },
  ];
}
