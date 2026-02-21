# Fix Command

`codegoat fix` reviews your code and generates patches for each finding. Interactive by default — you approve each fix before it's applied.

## Quick Start

```bash
# Interactive — review each fix before applying
codegoat fix .

# Auto-apply all fixes
codegoat fix . --apply

# Preview without writing files
codegoat fix . --apply --dry-run

# Fix only changed files
codegoat fix --diff main

# Fix only critical issues
codegoat fix . --severity critical
```

## Interactive Mode

Default behavior. Shows each finding with a proposed fix:

```
[1/3] 🔴 critical — src/auth.ts:42
Timing-unsafe password comparison

  Current:
  │ const isValid = user.passwordHash === password;

  Fix:
  │ const isValid = await bcrypt.compare(password, user.passwordHash);

  [a]ccept  [s]kip  [e]dit  [v]iew diff  [q]uit
```

| Key | Action |
|-----|--------|
| `a` | Apply this fix |
| `s` | Skip (don't fix) |
| `e` | Open fix in `$EDITOR` |
| `v` | Show unified diff |
| `A` | Accept all remaining |
| `q` | Quit (keep applied fixes) |

## Auto-Apply Mode

```bash
codegoat fix . --apply
```

Applies all fixes without prompting. A git stash is created before applying as a safety net:

```
💾 Created backup: git stash "codegoat-fix-backup-1708523400"
✅ src/auth.ts:42 — Fixed timing-unsafe comparison
✅ src/auth.ts:8 — Moved JWT secret to env var
✅ src/tasks.ts:18 — Changed to parameterized SQL
3 fixes applied to 2 files.
To undo: git stash pop
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--apply` | Auto-apply all fixes | `false` (interactive) |
| `--dry-run` | Preview fixes without writing | `false` |
| `--severity <level>` | Only fix findings at this level+ | `info` |
| `--diff [ref]` | Fix only changed files | — |
| `--no-stash` | Skip git stash safety net | `false` |
| `--max-fixes <n>` | Maximum fixes per run | `20` |
| `--format json` | Output fixes as JSON | `markdown` |
| `--line <n>` | Fix specific finding at line | — |

## Dry Run

Preview all fixes as a unified diff:

```bash
$ codegoat fix . --apply --dry-run

--- a/src/auth.ts
+++ b/src/auth.ts
@@ -8 +8,2 @@
-const JWT_SECRET = "super-secret-key-12345";
+const JWT_SECRET = process.env.JWT_SECRET;
+if (!JWT_SECRET) throw new Error("JWT_SECRET env var required");
@@ -42 +43 @@
-  const isValid = user.passwordHash === password;
+  const isValid = await bcrypt.compare(password, user.passwordHash);
```

Pipe to a patch file: `codegoat fix . --apply --dry-run > fixes.patch`

## Safety

- **Git stash** — auto-created before `--apply` (disable with `--no-stash`)
- **Git required** — refuses to apply fixes outside a git repo
- **Max 20 fixes** — prevents runaway auto-fixing (override with `--max-fixes`)
- **Syntax check** — for JS/TS, runs a quick type check after applying; reverts if it fails

## JSON Output

```bash
$ codegoat fix src/auth.ts --format json --dry-run
```

```json
{
  "findings": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "severity": "critical",
      "message": "Timing-unsafe password comparison",
      "fix": {
        "startLine": 42,
        "endLine": 42,
        "original": "  const isValid = user.passwordHash === password;",
        "replacement": "  const isValid = await bcrypt.compare(password, user.passwordHash);",
        "explanation": "Use bcrypt.compare for timing-safe verification"
      }
    }
  ]
}
```

## CI: GitHub PR Suggestions

With `suggest-fixes: true` in the GitHub Action, findings are posted as suggestion blocks:

````markdown
🔴 **critical** — Timing-unsafe password comparison

```suggestion
  const isValid = await bcrypt.compare(password, user.passwordHash);
```
````

The developer clicks "Apply suggestion" in GitHub to commit the fix directly.

```yaml
- uses: opengoat/codegoat@v1
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    suggest-fixes: true
```
