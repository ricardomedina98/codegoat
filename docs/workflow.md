# The Complete Workflow

codegoat covers the full code quality pipeline: **review → fix → test → docs**.

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  review  │ ──▶ │   fix    │ ──▶ │   test   │ ──▶ │   docs   │
│          │     │          │     │          │     │          │
│ find     │     │ generate │     │ generate │     │ generate │
│ issues   │     │ patches  │     │ tests    │     │ docs     │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

You can use each command independently, or chain them for a complete workflow.

---

## Step 1: Review

Find bugs, security issues, and improvements.

```bash
$ codegoat review src/auth.ts

🐐 codegoat review — src/auth.ts

🔴 critical — Line 42: Timing-unsafe password comparison
🔴 critical — Line 8: Hardcoded JWT secret
🟡 warning — Line 15: No password strength validation

Score: 4/10
```

## Step 2: Fix

Generate and apply fixes for each finding.

```bash
$ codegoat fix src/auth.ts

🐐 codegoat fix — src/auth.ts

[1/3] 🔴 critical — Line 42: Timing-unsafe password comparison

  Current:
  │ const isValid = user.passwordHash === password;

  Fix:
  │ const isValid = await bcrypt.compare(password, user.passwordHash);

  [a]ccept  [s]kip  [v]iew diff  [q]uit
  > a
  ✅ Applied

[2/3] 🔴 critical — Line 8: Hardcoded JWT secret

  Current:
  │ const JWT_SECRET = "super-secret-key-12345";

  Fix:
  │ const JWT_SECRET = process.env.JWT_SECRET;
  │ if (!JWT_SECRET) throw new Error("JWT_SECRET env var required");

  > a
  ✅ Applied

[3/3] 🟡 warning — Line 15: No password strength validation

  Fix: Add minimum length check

  > a
  ✅ Applied

3 fixes applied. Changes saved to src/auth.ts
```

## Step 3: Test

Generate tests for the fixed code.

```bash
$ codegoat test src/auth.ts

🐐 codegoat test — src/auth.ts

Framework detected: Jest
Functions found: 3 (login, register, verifyToken)
Existing tests: 0

✅ Written: src/auth.test.ts (3 suites, 12 test cases)
```

Generated tests cover:
- `login()` — valid credentials, invalid password, missing user, timing safety
- `register()` — happy path, duplicate email, weak password rejection
- `verifyToken()` — valid token, expired token, malformed token

## Step 4: Docs

Generate documentation.

```bash
$ codegoat docs src/auth.ts

🐐 codegoat docs — src/auth.ts

✅ Written: src/auth.md

## POST /auth/login
Authenticates a user with email and password.
**Request:** { email: string, password: string }
**Response:** { token: string }
...
```

---

## All at once

For a quick pre-push quality pass:

```bash
# Review and fix changed files
codegoat fix --diff main

# Generate tests for what you fixed
codegoat test --diff main

# Generate docs for changed files
codegoat docs --diff main
```

---

## In CI

```yaml
# .github/workflows/codegoat.yml
steps:
  - uses: opengoat/codegoat@v1
    with:
      api-key: ${{ secrets.OPENAI_API_KEY }}
      # Reviews PR, posts inline comments with fix suggestions
```

The CI integration runs `review` and posts findings as inline PR comments. With `suggest-fixes: true`, each finding includes an "Apply suggestion" button.

---

## Command Reference

| Command | What it does | Key flags |
|---------|-------------|-----------|
| `codegoat review <path>` | Find issues | `--diff`, `--severity`, `--fail-on`, `--watch` |
| `codegoat fix <path>` | Generate + apply fixes | `--apply`, `--dry-run`, `--diff` |
| `codegoat test <path>` | Generate unit tests | `--framework`, `--dry-run`, `--diff` |
| `codegoat docs <path>` | Generate documentation | `--diff` |

All commands support `--format json` for tooling integration.
