import type { DiscoveredFile } from "./discover.js";

export interface BudgetResult {
  included: DiscoveredFile[];
  skipped: DiscoveredFile[];
  totalTokens: number;
}

const DEFAULT_MAX_TOKENS = 100_000;

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export function budgetFiles(
  files: DiscoveredFile[],
  maxTokens: number = DEFAULT_MAX_TOKENS
): BudgetResult {
  const sorted = [...files].sort((a, b) => a.sizeBytes - b.sizeBytes);

  const included: DiscoveredFile[] = [];
  const skipped: DiscoveredFile[] = [];
  let totalTokens = 0;

  for (const file of sorted) {
    const tokens = estimateTokens(file.content);
    if (totalTokens + tokens <= maxTokens) {
      included.push(file);
      totalTokens += tokens;
    } else {
      skipped.push(file);
    }
  }

  return { included, skipped, totalTokens };
}
