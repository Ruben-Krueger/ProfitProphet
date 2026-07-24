# Project Style Guide — React + TypeScript + Vercel Serverless Functions

This document defines coding standards for this project. Follow it for all new
code and when editing existing code. When in doubt, favor explicitness and type
safety over brevity.

---

## 1. Guiding Principles

- **Type safety is non-negotiable.** The compiler should catch bugs before
  runtime.
- **Explicit over clever.** Prefer readable, boring code over dense one-liners.
- **Fail loudly, fail early.** Validate inputs at boundaries (API routes, forms,
  env vars).
- **Small, focused units.** One component, one hook, one responsibility per
  file.

---

## 2. TypeScript Rules

### 2.1 Never use `any`

`any` disables type checking entirely and defeats the purpose of TypeScript. It
is banned in this codebase.

```ts
// ❌ Never
function parseData(input: any) {
  return input.value;
}

// ✅ Use `unknown` + narrowing
function parseData(input: unknown) {
  if (typeof input === "object" && input !== null && "value" in input) {
    return (input as { value: string }).value;
  }
  throw new Error("Invalid input shape");
}

// ✅ Or validate with a schema (preferred for external data)
import { z } from "zod";

const DataSchema = z.object({ value: z.string() });
function parseData(input: unknown) {
  return DataSchema.parse(input).value;
}
```

Enforce this at the tooling level, not just by convention:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
  },
}
```

```jsonc
// .eslintrc — fail the build on any
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-non-null-assertion": "warn",
  },
}
```

If a third-party type is genuinely unknown, use `unknown` and narrow it — never
reach for `any` as an escape hatch, and never suppress the rule with
`// eslint-disable-next-line` without a comment explaining why.

### 2.2 Prefer inference, but be explicit at boundaries

```ts
// ✅ Let TS infer simple local values
const count = 0;
const items = ["a", "b"];

// ✅ Always annotate function signatures that are exported or cross a boundary
export function getUser(id: string): Promise<User> { ... }

// ✅ Always annotate API handler signatures
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> { ... }
```

### 2.3 Model state with discriminated unions, not booleans

```ts
// ❌ Booleans multiply into impossible states
interface State {
  isLoading: boolean;
  isError: boolean;
  data?: User;
}

// ✅ One valid shape at a time
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User }
  | { status: "error"; error: string };
```

### 2.4 Other rules

- No non-null assertions (`!`) unless immediately preceded by a comment
  justifying it.
- Use `readonly` for arrays/objects that shouldn't be mutated.
- Use the `satisfies` operator instead of a type annotation when you also want
  literal-type inference preserved:
  ```ts
  const config = { env: "production" } satisfies AppConfig;
  ```
- Prefer string-literal unions or `as const` objects over `enum`:
  ```ts
  // ✅
  const Role = { Admin: "admin", User: "user" } as const;
  type Role = (typeof Role)[keyof typeof Role];
  ```
- No implicit `Function` or `object` types — always describe the shape.
- Shared types live in `src/types/`, colocated types live next to their
  component/hook.

---

## 3. React Component Guidelines

- Functional components only. No class components.
- One component per file. File name matches component name: `UserCard.tsx`.
- Props are always typed with an interface named `<Component>Props`:

  ```tsx
  interface UserCardProps {
    user: User;
    onSelect?: (id: string) => void;
  }

  export function UserCard({ user, onSelect }: UserCardProps) {
    ...
  }
  ```

- No default exports for components — use named exports for better refactor
  tooling and consistent imports.
- Custom hooks start with `use` and live in `src/hooks/`.
- Follow the Rules of Hooks: no conditional hooks, no hooks in loops.
- Don't reach for `useEffect` to derive state that can be computed during
  render.
- Only memoize (`useMemo`/`useCallback`) when profiling shows it's needed, or
  when passing callbacks/objects to memoized children — not by default.
- Wrap route-level or data-fetching subtrees in an `ErrorBoundary`.
- Co-locate tests: `UserCard.tsx` + `UserCard.test.tsx` in the same folder.

---

## 4. Project Structure

```
src/
  components/       # Reusable UI components
  hooks/            # Custom hooks
  types/            # Shared TypeScript types
  lib/              # Framework-agnostic utilities
  pages/ or app/     # Routes
api/                # Vercel serverless functions
  users/
    [id].ts
  webhooks/
    stripe.ts
```

---

## 5. Vercel Serverless Functions

### 5.1 Typed handlers

```ts
// api/users/[id].ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

const ParamsSchema = z.object({ id: z.string().uuid() });

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parseResult = ParamsSchema.safeParse(req.query);
  if (!parseResult.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parseResult.error.flatten() });
    return;
  }

  try {
    const user = await getUser(parseResult.data.id);
    res.status(200).json(user);
  } catch (err) {
    console.error("getUser failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

### 5.2 Rules

- **Validate every input** (query params, body, headers) with `zod` — never
  trust `req.body` shape from a type annotation alone.
- **Always check `req.method`** and reject unsupported methods with `405`.
- **Consistent error shape** across all endpoints, e.g.
  `{ error: string, details?: unknown }`.
- **Never leak internals** in error responses (stack traces, SQL errors) — log
  server-side, return a generic message to the client.
- **Read env vars through a validated config module**, not `process.env.X`
  scattered across files:
  ```ts
  // lib/env.ts
  const EnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string(),
  });
  export const env = EnvSchema.parse(process.env);
  ```
- Prefer Edge Functions (`export const config = { runtime: "edge" }`) for
  latency-sensitive, stateless endpoints; use Node runtime when you need
  Node-specific APIs or larger dependencies.
- Keep handlers thin — business logic belongs in `lib/`, the handler just wires
  validation → logic → response.
- Set explicit `maxDuration` in `vercel.json` for long-running functions rather
  than relying on defaults.

---

## 6. State Management

- Local UI state → `useState`/`useReducer`.
- Server data → a data-fetching library (e.g. TanStack Query) rather than
  hand-rolled `useEffect` + `useState` fetching.
- Global client state → only introduce a store (Zustand, Redux, etc.) when state
  is genuinely shared across distant parts of the tree — not by default.

---

## 7. Linting & Formatting

- ESLint with `@typescript-eslint`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react`.
- Prettier for formatting; no manual formatting debates — run on save /
  pre-commit.
- `no-explicit-any`, `no-unused-vars`, `no-non-null-assertion` (warn), and
  `react-hooks/exhaustive-deps` are all enforced, not advisory.
- CI fails the build on any lint error, not just type error.

---

## 8. Testing

- Unit tests: Jest, colocated with source.
- Component tests: React Testing Library — test behavior, not implementation.
- API route tests: hit the handler directly with mock
  `VercelRequest`/`VercelResponse`, or use integration tests against a local dev
  server.
- No `any` in test files either — mock data should satisfy real types.

---
