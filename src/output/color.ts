export interface Colors {
  bold(s: string): string;
  dim(s: string): string;
  red(s: string): string;
  yellow(s: string): string;
  green(s: string): string;
  cyan(s: string): string;
  reset(s: string): string;
}

function wrap(code: string, s: string): string {
  return `\x1b[${code}m${s}\x1b[0m`;
}

const REAL_COLORS: Colors = {
  bold: (s) => wrap("1", s),
  dim: (s) => wrap("2", s),
  red: (s) => wrap("31", s),
  yellow: (s) => wrap("33", s),
  green: (s) => wrap("32", s),
  cyan: (s) => wrap("36", s),
  reset: (s) => wrap("0", s),
};

const NO_COLORS: Colors = {
  bold: (s) => s,
  dim: (s) => s,
  red: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  cyan: (s) => s,
  reset: (s) => s,
};

export function createColors(enabled: boolean): Colors {
  return enabled ? REAL_COLORS : NO_COLORS;
}

export function shouldColor(noColorFlag: boolean): boolean {
  if (noColorFlag) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  return !!process.stdout.isTTY;
}
