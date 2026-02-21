/**
 * Centralized logging with --verbose and --quiet support.
 * Exit codes: 0=success, 1=findings above threshold, 2=config/usage error, 3=network/API error
 */

export const EXIT_SUCCESS = 0;
export const EXIT_FINDINGS = 1;
export const EXIT_CONFIG_ERROR = 2;
export const EXIT_NETWORK_ERROR = 3;

let verboseMode = false;
let quietMode = false;

export function setVerbose(v: boolean): void { verboseMode = v; }
export function setQuiet(q: boolean): void { quietMode = q; }
export function isVerbose(): boolean { return verboseMode; }
export function isQuiet(): boolean { return quietMode; }

/** Always shown (errors). */
export function error(msg: string): void {
  console.error(`❌ ${msg}`);
}

/** Shown unless --quiet. */
export function info(msg: string): void {
  if (!quietMode) console.error(msg);
}

/** Only shown with --verbose. */
export function debug(msg: string): void {
  if (verboseMode) console.error(`[debug] ${msg}`);
}

/** Warn (always shown). */
export function warn(msg: string): void {
  console.error(`⚠️  ${msg}`);
}

/**
 * Wrap an async operation with graceful error handling.
 * Catches network errors, invalid configs, etc. and exits with proper code.
 */
export function classifyError(err: unknown): { message: string; exitCode: number } {
  const msg = err instanceof Error ? err.message : String(err);

  // Network / API errors
  if (msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") ||
      msg.includes("ETIMEDOUT") || msg.includes("API error") || msg.includes("401") ||
      msg.includes("403") || msg.includes("429") || msg.includes("500") ||
      msg.includes("502") || msg.includes("503")) {
    return { message: msg, exitCode: EXIT_NETWORK_ERROR };
  }

  // Config / usage errors
  if (msg.includes("API key") || msg.includes("config") || msg.includes("invalid") ||
      msg.includes("not found") || msg.includes("Unknown provider")) {
    return { message: msg, exitCode: EXIT_CONFIG_ERROR };
  }

  // Default to network error for unknown errors during review
  return { message: msg, exitCode: EXIT_NETWORK_ERROR };
}
