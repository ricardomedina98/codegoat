import { createColors, type Colors } from "./color.js";

export interface ReviewResult {
  raw: string;
  filesScanned: number;
  filesSkipped: number;
  estimatedTokens: number;
}

function colorizeMarkdown(text: string, c: Colors): string {
  return text
    .replace(/\*\*Bug\b/g, `**${c.red("Bug")}`)
    .replace(/\*\*Security\b/g, `**${c.red("Security")}`)
    .replace(/\*\*Performance\b/g, `**${c.yellow("Performance")}`)
    .replace(/\*\*Style\b/g, `**${c.cyan("Style")}`)
    .replace(/\*\*Clarity\b/g, `**${c.cyan("Clarity")}`);
}

export function formatMarkdown(result: ReviewResult, useColor: boolean): string {
  const c = createColors(useColor);
  const total = result.filesScanned + result.filesSkipped;
  const skipNote = result.filesSkipped > 0
    ? ` (${result.filesSkipped} skipped — over token budget)`
    : "";

  const header = [
    c.bold("## codegoat review"),
    "",
    c.dim(`Files scanned: ${result.filesScanned} of ${total}${skipNote}`),
    c.dim(`Estimated tokens: ${result.estimatedTokens.toLocaleString()}`),
    "",
    "---",
    "",
  ].join("\n");

  const body = useColor ? colorizeMarkdown(result.raw, c) : result.raw;

  return header + body;
}

export function formatJson(result: ReviewResult): string {
  return JSON.stringify(
    {
      version: "0.1.0",
      filesScanned: result.filesScanned,
      filesSkipped: result.filesSkipped,
      estimatedTokens: result.estimatedTokens,
      review: result.raw,
    },
    null,
    2
  );
}
