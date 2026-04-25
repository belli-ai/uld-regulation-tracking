# CLAUDE.md — Cool-Chain Copilot Hackathon

## Primary Rule

**Active workspace is `hackathon/` (this directory).** Do not touch `belli/` or `belli-api/` — they are unrelated Belli production code. This project is a **standalone Next.js hackathon entry** for the Jettainer ULD Challenge.

Claude operates as **engineering lead** — coordinates, plans, verifies. Code writing is delegated to Codex via `codex:codex-rescue` invoked by the FE dev teammate.

## Project Status

- Hackathon entry, scope tightly bounded (see `PLAN.md`)
- Frontend-only, no backend, session/local persistence
- 1-day build target
- Quality bar: working demo > test coverage. No CI, no e2e, no production hardening.

## Stack

- **Framework**: Next.js 14 + TypeScript + App Router
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (with `localStorage` middleware for prefs)
- **Persistence**: `localStorage` (prefs) · `sessionStorage` (demo state) · `IndexedDB` via Dexie (optional, for telemetry history)
- **Geometry**: `@turf/turf` for geofence
- **Charts**: `recharts`
- **Map**: `react-leaflet` + OpenStreetMap tiles
- **PWA**: `next-pwa`
- **Notifications**: native Web Notifications API
- **Package manager**: `pnpm`
- **Deploy**: Vercel (single deploy URL)

## Quick Reference

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Dev server | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Production build | `pnpm build` |
| Full verify (MANDATORY before claiming work done) | `pnpm typecheck && pnpm lint && pnpm build` |
| Format | `pnpm format` |
| Deploy preview to Vercel | `vercel` |
| Deploy production | `vercel --prod` |

## Engineering Lead Mode

### Role & Delegation

You do NOT write code. Delegate to teammates:
- **`hackathon-dev`** — Opus full-stack orchestrator that shapes prompts and spawns `codex:codex-rescue` for actual file edits. Verifies via the framework-appropriate build/test chain (default: `pnpm typecheck && pnpm lint && pnpm build`).
- **`hackathon-reviewer`** — Sonnet reviewer for diffs after major features. Catches correctness bugs, mobile UX regressions, state management bugs, server/client boundary issues, build-time issues.

For hackathon time pressure, **a team is overkill** — most work is single-stream. Skip `TeamCreate` unless you genuinely have parallel independent tasks. Spawn `hackathon-dev` directly for sequential work.

### Skills (use yourself during planning + verification)

- **`brainstorming`** — re-scope when adding/removing features
- **`writing-plans`** — break large tasks into Codex-sized units
- **`verification-before-completion`** — never claim work done without running verify command and seeing it pass
- **`web-design-guidelines`** — review handler mobile UI for one-handed usability

### Workflow

1. **Plan** — break feature into Codex-sized units. Each unit should be small enough that a `pnpm build` failure points at one place.
2. **Spawn `hackathon-dev`** with shaped prompt including:
   - Absolute path: `/Users/abelramadhan/projects/belli-workspace/hackathon`
   - Files to create/modify
   - Acceptance criteria (visible behavior + types compile)
   - Verification command
3. **Verify** — after teammate returns:
   - `pnpm typecheck && pnpm lint && pnpm build`
   - Open `localhost:3000`, click through the new feature
   - For mobile features: use Chrome DevTools mobile emulation (iPhone 14 Pro)
4. **Iterate** — if verify fails, send corrections via `SendMessage`
5. **Review pass after major feature** — spawn `hackathon-reviewer` on the diff

## Code Conventions

### File naming
- kebab-case for files: `thermal-budget-bar.tsx`, `shc-loader.ts`
- React components: PascalCase exports, kebab-case filenames
- Routes follow Next.js App Router conventions

### TypeScript
- Strict typing. No `any` without justification comment.
- Prefer `type` over `interface` unless declaration merging is needed.
- Co-locate component prop types with the component.

### React / Next.js
- App Router everywhere. No `pages/` directory.
- Server Components by default. `'use client'` only when needed (state, effects, browser APIs).
- Most of this app is client-side (Web Notifications, localStorage, `setInterval` simulator) — accept that and don't over-engineer SSR.
- shadcn/ui components installed via `pnpm dlx shadcn-ui@latest add <component>` — do NOT hand-roll buttons/inputs/cards.
- Compose styles with Tailwind utility classes; avoid CSS modules.

### Mobile-first
- Handler routes (`/`, `/alert/[uldId]`, `/scan`) MUST work on a 375px viewport with one-thumb operation.
- Tap targets minimum 44x44px (Apple HIG).
- Test with Chrome DevTools mobile emulation BEFORE claiming any handler-facing work done.

### State & persistence
- Use Zustand stores in `lib/stores/` — one store per concern (uld-store, demo-clock-store, resources-store).
- Wrap `localStorage` access through `lib/persistence/local-prefs.ts` — never call `localStorage` directly in components.
- All persistence is best-effort — if storage fails, app must still work in-memory.

### Demo discipline
- All injectable demo events live behind `/dev/inject` route (hidden in production via `NEXT_PUBLIC_DEMO_MODE` env).
- Mock data in `public/data/` and `public/config/` — never hardcode demo state in components.
- Deterministic timing: scenario runner advances logical clock at fixed `setInterval` tick. No `Math.random()` without a seeded RNG.

### Comments
- Default: write none. Identifier names should explain themselves.
- Add a comment ONLY when the WHY is non-obvious (subtle invariant, hidden constraint, workaround).
- Never explain WHAT the code does.

## Critical Rules

### Bash Working Directory

All work happens in `/Users/abelramadhan/projects/belli-workspace/hackathon`. Use absolute paths in Bash commands — do not assume cwd from previous calls. The workspace persists between Bash invocations.

```bash
# Good
pnpm --dir /Users/abelramadhan/projects/belli-workspace/hackathon build

# Risky (assumes cwd from previous call)
pnpm build
```

### Subagent Working Directory

Codex subagents start with a fresh shell — they do NOT inherit cwd. The `hackathon-dev` teammate MUST embed the absolute path in any Codex prompt.

### Verification Discipline

- Never claim "done" without running `pnpm typecheck && pnpm lint && pnpm build` and seeing zero errors.
- Never claim a UI feature works without opening it in a browser and clicking through.
- Never claim mobile-friendly without testing in mobile viewport.

### Demo-Readiness Override

For the final 30 minutes before demo:
- No new features. Bug fixes only.
- Rehearse the full scripted timeline twice.
- Have a fallback: if live URL fails, open localhost. If localhost fails, open recorded video.

## What NOT to do

- Do not touch `belli/` or `belli-api/` — those are unrelated Belli prod code.
- Do not add a backend. The whole project runs in the browser.
- Do not pull in Clerk, TanStack Query, Liveblocks, or any other Belli-specific dependency that doesn't apply here.
- Do not write tests for the demo path — focus all time on working features. (Optional small tests for the PCM physics integrator are acceptable if time permits.)
- Do not optimize for production scale. This is a 1-day hackathon entry, not a SaaS.

## See Also

- `PLAN.md` — full project plan, architecture, demo scenario, build hours
- `AGENTS.md` — code conventions Codex auto-reads when invoked
- `.claude/agents/hackathon-dev.md` — full-stack orchestrator definition
- `.claude/agents/hackathon-reviewer.md` — full-stack reviewer definition
