# Examples

Real output examples for every codegoat command.

---

## codegoat review — Full repo review

Review all supported files in a directory.

### Basic usage

```bash
$ codegoat review ./src
```

```
🐐 codegoat review — src/

Reviewing 12 files (4,231 lines)...

## Summary

Express API with clean separation of concerns. Authentication module needs
attention — two security issues found.

### src/routes/auth.ts
🔴 critical — Line 42: Password comparison uses `===` instead of
   `crypto.timingSafeEqual()`. Vulnerable to timing attacks.

🔴 critical — Line 67: JWT secret is hardcoded as string literal.
   Move to environment variable.

### src/middleware/rateLimit.ts
🟡 warning — Line 15: Rate limit counter uses in-memory Map. Resets on
   server restart. Use Redis for production.

### src/services/payment.ts
🟡 warning — Line 89: `processPayment()` has no error handling for
   network timeouts. The gateway.charge() call can hang indefinitely.

🔵 info — Line 23: Consider splitting this 180-line file. Payment
   validation could be its own module.

### src/utils/validate.ts
🔵 info — Line 8: `validateEmail()` regex is overly permissive.
   Consider using zod for schema validation.

### src/routes/users.ts
✅ Clean CRUD with proper error handling. Looks good.

### src/routes/products.ts
✅ No issues found.

---
12 files · 🔴 2 critical · 🟡 2 warnings · 🔵 2 info
Score: 5/10
```

### With severity filter

```bash
$ codegoat review ./src --severity warning
```

```
🐐 codegoat review — src/

12 files reviewed · 🔴 2 · 🟡 2 (2 info hidden)

### src/routes/auth.ts
🔴 critical — Line 42: Password comparison uses `===` instead of
   crypto.timingSafeEqual()
🔴 critical — Line 67: JWT secret is hardcoded as string literal

### src/middleware/rateLimit.ts
🟡 warning — Line 15: Rate limit counter resets on server restart

### src/services/payment.ts
🟡 warning — Line 89: No error handling for network timeouts

Score: 5/10
```

### JSON output

```bash
$ codegoat review ./src --format json
```

```json
{
  "mode": "full",
  "summary": "Express API with clean separation. Auth module needs attention.",
  "filesReviewed": 12,
  "findings": [
    {
      "file": "src/routes/auth.ts",
      "line": 42,
      "severity": "critical",
      "message": "Password comparison uses === instead of crypto.timingSafeEqual()"
    },
    {
      "file": "src/routes/auth.ts",
      "line": 67,
      "severity": "critical",
      "message": "JWT secret is hardcoded as string literal"
    },
    {
      "file": "src/middleware/rateLimit.ts",
      "line": 15,
      "severity": "warning",
      "message": "Rate limit counter resets on server restart (in-memory store)"
    },
    {
      "file": "src/services/payment.ts",
      "line": 89,
      "severity": "warning",
      "message": "No error handling for network timeouts in processPayment()"
    },
    {
      "file": "src/services/payment.ts",
      "line": 23,
      "severity": "info",
      "message": "Consider splitting 180-line file — extract payment validation"
    },
    {
      "file": "src/utils/validate.ts",
      "line": 8,
      "severity": "info",
      "message": "Email regex is overly permissive — consider zod for validation"
    }
  ],
  "counts": {
    "critical": 2,
    "warning": 2,
    "info": 2,
    "style": 0
  },
  "maxSeverity": "critical",
  "score": 5
}
```

---

## codegoat review --diff — PR/diff review

Review only changed files. The most common mode for daily development.

### Staged changes (pre-commit)

```bash
$ codegoat review --diff
```

```
🐐 codegoat review — staged changes

2 files changed, 23 lines added, 5 removed

### src/services/payment.ts
🟡 warning — Line 94 (added): `validate()` can return undefined when
   amount is NaN. Add explicit check before calling gateway.

### src/utils/validator.ts
✅ New helper follows existing patterns. Looks good.

---
2 files · 🟡 1 warning
Score: 8/10
```

### Diff against a branch

```bash
$ codegoat review --diff main
```

```
🐐 codegoat review — diff vs main

5 files changed, 147 lines added, 32 removed

### src/services/payment.ts
🔴 critical — Line 94: validate() can return undefined for NaN amounts.
   This propagates to gateway.charge() causing a 500 error.

🟡 warning — Line 102: Amount not validated for negative values.

### src/routes/checkout.ts
🟡 warning — Line 45: New endpoint has no rate limiting.

### src/utils/validator.ts
✅ Clean implementation.

### tests/payment.test.ts
🔵 info — No test for the NaN edge case in validate().

### tests/checkout.test.ts
✅ Good coverage of the new endpoint.

---
5 files · 🔴 1 critical · 🟡 2 warnings · 🔵 1 info
Score: 7/10
```

### Specific commit range

```bash
$ codegoat review --diff HEAD~3..HEAD
```

Reviews only the changes in the last 3 commits.

---

## codegoat docs — Documentation generation

Generate documentation from your code. *(Coming soon)*

### Preview

```bash
$ codegoat docs ./src
```

```
🐐 codegoat docs — src/

Generating documentation for 12 files...

## src/routes/auth.ts

### POST /auth/login

Authenticates a user with email and password.

**Request body:**
- `email` (string, required) — User's email address
- `password` (string, required) — User's password

**Response:**
- `200` — Returns JWT token in `{ token: string }`
- `401` — Invalid credentials
- `429` — Rate limited

**Notes:**
- Token expires in 24 hours
- Uses bcrypt for password hashing

### POST /auth/register

Creates a new user account.
...
```

---

## Using custom rules

With a `.codegoatrc` that includes project-specific rules:

```yaml
# .codegoatrc
rules:
  - "All monetary values must be integers (cents), never floats"
  - "[critical] Never use console.log in production code"
context: |
  FinTech app. Money is in cents. We use Logger service for logging.
```

```bash
$ codegoat review ./src
```

```
🐐 codegoat review — src/

### src/services/billing.ts
🟡 warning — Line 34: `amount * 0.16` produces a float for tax
   calculation. Per project rules, monetary values must be integers (cents).
   Use Math.round(amount * 16 / 100) instead.

🔴 critical — Line 78: console.log(user.email) found in production code.
   Per project rules, use the Logger service instead.
```

The LLM incorporates your rules into its review, catching project-specific issues that generic reviews would miss.
