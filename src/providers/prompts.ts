import type { ChatMessage } from "./types.js";

// === Review Prompts ===

const REVIEW_SYSTEM_PROMPT =
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
    { role: "system", content: REVIEW_SYSTEM_PROMPT },
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
    "For each exported function, class, or interface, write a JSDoc/TSDoc comment block. " +
    "Include: a one-line summary, @param descriptions, @returns description, and any important notes. " +
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
    "generate a JSDoc/TSDoc comment. Format as:\n\n" +
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
