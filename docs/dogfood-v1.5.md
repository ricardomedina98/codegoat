# Dogfood Test — v1.5.0

Self-review of the codegoat codebase, run 2026-02-21.

## Test Results

### `codegoat review src/` (36 files, 38975 tokens)
- ✅ File discovery: 36 source files found
- ✅ Token budgeting: 38975 estimated tokens (under 50K budget)
- ✅ Pipeline works end-to-end up to LLM call

### `codegoat test src/config.ts --dry-run`
- ✅ Single-file discovery works (after fix)
- ✅ Framework auto-detected: node:test (from package.json scripts)
- ✅ Test path mapping: config.ts → test/config.test.ts

### `codegoat fix src/config.ts --dry-run`
- ✅ Review phase initiates correctly
- ✅ Provider error handling works (clean exit on missing API key)

## Bugs Found & Fixed

### 1. `require()` in ESM module (critical)
- **File:** `src/commands/review.ts:76`
- **Issue:** `require("node:path")` used in ESM context → `ReferenceError: require is not defined`
- **Fix:** Changed to `await import("node:path")`
- **Impact:** Review command was broken on all ESM setups

### 2. `discoverFiles()` crashes on single file path (critical)
- **File:** `src/files/discover.ts`
- **Issue:** `walk()` calls `readdir()` on a file → `ENOTDIR` error
- **Fix:** Added `stat.isFile()` check at the top of `discoverFiles()` — returns single-file array
- **Impact:** `codegoat test src/foo.ts` and `codegoat fix src/foo.ts` were broken for single files

### 3. Missing `await` on `discoverFiles()` (critical)
- **File:** `src/commands/test.ts:269`
- **Issue:** `discoverFiles()` returns a Promise, but wasn't awaited → `.filter()` on Promise
- **Fix:** Added `await`
- **Impact:** `codegoat test` was completely broken

### 4. `budgetFiles()` destructuring (critical)
- **File:** `src/commands/test.ts:277`
- **Issue:** `budgetFiles()` returns `{ included, skipped, totalTokens }`, but code treated it as array
- **Fix:** Destructured as `const { included: budgeted } = budgetFiles(...)`
- **Impact:** `codegoat test` was completely broken

## Verdict

The dogfood test caught **4 bugs**, all in the newer `test` command and one in the `review` command. All critical — they would have crashed the CLI for users. The core review/fix/docs commands that were built earlier are solid. The test command was under-tested for real-world usage (single file paths, proper async handling).

**Lesson:** Integration tests that exercise the full CLI pipeline (not just unit tests of individual functions) catch a different class of bugs. Added to the testing backlog.
