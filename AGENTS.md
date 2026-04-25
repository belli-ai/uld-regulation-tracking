# AGENTS.md — Cool-Chain Copilot Hackathon

Conventions for Codex (and any AI coding agent) operating in `/Users/abelramadhan/projects/belli-workspace/hackathon`.

This file is auto-read by Codex when invoked from this directory or any subdirectory. It complements `CLAUDE.md` (which is for the orchestrator). Keep both in sync — when this changes, audit `CLAUDE.md`.

## Project Posture

- **Frontend-only Next.js 14 PWA**, TypeScript, App Router.
- **Hackathon entry** — quick-and-dirty wins over production hardening.
- **Demo-driven** — every feature must serve the 3-minute scripted demo (see `PLAN.md` Demo Scenario section).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Zustand for state, with `localStorage` middleware for prefs
- `localStorage` (prefs) · `sessionStorage` (demo state) · `IndexedDB` via Dexie (optional)
- `@turf/turf`, `recharts`, `react-leaflet`, `next-pwa`, native Web Notifications API
- pnpm

## File Conventions

- **kebab-case** for all filenames: `thermal-budget-bar.tsx`, `shc-loader.ts`, `state-classifier.ts`.
- React component file exports the component as a named export with PascalCase: `export function ThermalBudgetBar(props: Props)`.
- Co-locate prop types with the component:
  ```ts
  type Props = { uld: Uld; onExecute: (actionId: string) => void };
  export function ActionCard({ uld, onExecute }: Props) { ... }
  ```
- One component per file. Helpers used only by one component live in the same file.
- Shared utilities live in `lib/<concern>/`.

## TypeScript Conventions

- Strict typing. **No `any` without an inline `// reason: ...` comment.**
- Prefer `type` over `interface`.
- `unknown` for true unknowns; narrow with type guards.
- Use template literal types for SHC codes, state names, etc., where the union is small and finite:
  ```ts
  type ShcCode = 'AVI' | 'PER' | 'COL' | 'CRT' | 'FRO' | 'HEG';
  type UldState = 'warehouse-cool-room' | 'airside-loading' | 'in-flight' | ...;
  ```
- Export shared types from `lib/types.ts`.

## React / Next.js Conventions

- App Router only. No `pages/`.
- Default to **client components** for this project — most features need browser APIs (Web Notifications, `setInterval`, `localStorage`). Mark with `'use client'` at the top.
- shadcn/ui first. Add components via `pnpm dlx shadcn-ui@latest add <component>` — do not hand-roll Button, Card, Input, Sheet, Dialog, etc.
- Avoid `useEffect` for state synchronization — derive instead. The only acceptable `useEffect` use cases here are: starting `setInterval`, registering Web Notifications, hydrating from `localStorage` on mount.
- Avoid `useRef` unless integrating with imperative DOM (Leaflet, Notification API).
- List rendering: stable keys (use object IDs, not array indices).

## Mobile-First Discipline

Handler-facing routes (`/`, `/alert/[uldId]`, `/scan`):
- Design for 375px viewport first, scale up.
- Tap targets minimum 44x44px.
- Avoid hover-only interactions.
- One-thumb operation: primary actions in the lower 60% of the screen.
- Use `text-base` minimum for body text (16px) — handlers may be wearing gloves and squinting in sunlight.
- High-contrast colors for status (use SHC config color values).

## State & Persistence

- One Zustand store per concern. Co-locate store definition + selectors:
  ```ts
  // lib/stores/uld-store.ts
  type UldStore = { ulds: Uld[]; updateUld: (id: string, patch: Partial<Uld>) => void };
  export const useUldStore = create<UldStore>()(persist(
    (set) => ({ ulds: [], updateUld: (id, patch) => set(/* ... */) }),
    { name: 'uld-store', storage: createJSONStorage(() => localStorage) }
  ));
  ```
- Wrap all `localStorage` access through `lib/persistence/local-prefs.ts`. Never call `localStorage` directly in components.
- Persistence is best-effort. Code must work if storage is unavailable (private browsing, quota exceeded).

## Mock Data Conventions

- All mock JSON lives under `public/data/` and `public/config/`.
- Loaders in `lib/loaders/` fetch with `cache: 'no-store'` for hot-reloadability during demo.
- Cache-bust SHC config fetches with `?t=${Date.now()}` query string when reloading after edits.

## Physics, Inference, Recommender, Scheduler

- Pure functions where possible. Easier to reason about, easier to test.
- Place pure compute in `lib/physics/`, `lib/inference/`, `lib/recommender/`, `lib/scheduler/`.
- Each module exports a small, documented public surface — internal helpers stay private (`function helper()` not `export function helper()`).
- The PCM physics integrator (`lib/physics/pcm-model.ts`) is the only module worth a small Vitest test if time permits — verify monotonic budget drain at constant high ambient.

## Demo Discipline

- All injectable demo events behind `/dev/inject` route.
- Hide `/dev/*` routes in production via `process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'` guard.
- Scenario runner uses a single `setInterval` tick — do not spawn multiple competing tickers.
- Deterministic: no `Math.random()` without a seeded RNG. Demo timing must be reproducible.

## Comments

- Default: write none.
- Add ONLY when the WHY is non-obvious (subtle invariant, hidden constraint, workaround for a specific edge case).
- Never explain WHAT the code does — well-named identifiers do that.
- Never reference "the current task" or "the demo" in comments — those rot.

## Things to Avoid

- No backend code. No server actions that mutate. No API routes calling external services. (Static fetches of `/public/` JSON are fine.)
- No Belli-specific dependencies (Clerk, TanStack Query, Liveblocks, Radix base). Use shadcn/ui (which wraps Radix) for primitives.
- No tests beyond optional PCM physics check.
- No production-grade error handling — log to console, fail soft.
- No analytics, no telemetry to external services.
- No CSS modules, no styled-components — Tailwind only.
- No hand-rolled UI primitives when shadcn has it (Button, Card, Input, Sheet, Dialog, Select, Toast, etc.).

## Verification (run before claiming done)

```bash
cd /Users/abelramadhan/projects/belli-workspace/hackathon && pnpm typecheck && pnpm lint && pnpm build
```

Zero errors required. After build passes, manually click through the affected feature in `pnpm dev` (mobile viewport for handler routes).
