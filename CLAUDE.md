# CLAUDE.md — Cool-Chain Copilot Hackathon

## Primary Rule

**Active workspace is `hackathon/` (this directory).** Do not touch `belli/` or `belli-api/` — they are unrelated Belli production code. This project is a **standalone Next.js hackathon entry** for the Jettainer ULD Challenge.

**Source of truth split:**
- `PLAN.md` — design (architecture, data model, demo, design system). Stable; cite by section.
- `MILESTONES.md` — live work breakdown + status board. Master orchestrator updates this every claim/complete.
- `MOCK_DATA.md` — fixture contracts. M2 implements exactly what's here.
- `style-guide.json` — design tokens (binding).

## Project Status

- Hackathon entry, scope locked (see `PLAN.md → Scope (locked)`)
- **Frontend + small Next.js API routes** (stateless adapters to external APIs); no DB
- Persistence client-only: `localStorage` / `sessionStorage` / `IndexedDB` via Dexie
- Single-station (DXB) demo; desktop-first
- Quality bar: working demo > test coverage. No CI, no e2e, no production hardening.

## Stack

- **Framework**: Next.js 15 + TypeScript + App Router
- **Styling**: Tailwind CSS v4 + shadcn/ui (OKLCH tokens, dark default)
- **Theming**: `next-themes`
- **Typography**: Geist Mono via `next/font/google`
- **State**: Zustand (with `localStorage` middleware for prefs)
- **Persistence**: `localStorage` (prefs) · `sessionStorage` (demo state, mock inventory mutations) · `IndexedDB` via Dexie (audit logs, telemetry)
- **Geometry**: `@turf/turf` (geofence inference)
- **Charts**: `recharts`
- **Map**: `react-leaflet` + free raster tiles (CartoDB Dark Matter / Voyager / OSM fallback) — no API key
- **Validation**: Zod (scenario schema runtime guard)
- **Animations**: `tw-animate-css`
- **Component variants**: `class-variance-authority` (cva) + `clsx` + `tailwind-merge` via `cn()` helper
- **Icons**: `lucide-react`
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
| Validate fixtures (M2 gate) | `pnpm tsx scripts/validate-fixtures.ts` |
| Format | `pnpm format` |
| Deploy preview | `vercel` |
| Deploy production | `vercel --prod` |

## Implementation Team Structure

Hierarchical multi-agent flow. Three layers, each with a tight role.

```
┌─────────────────────────────────────────────────────────────────────┐
│  YOU (master orchestrator) — top of chain                            │
│  • Reads MILESTONES.md status board to pick the next milestone(s)    │
│  • Phase-gated: never starts Phase N+1 until all of Phase N is 🟢    │
│  • For parallel-safe milestones, can spawn multiple sub-orchestrators│
│    in a single message                                               │
│  • Claims milestones in MILESTONES.md (Status: 🟡, Owner)            │
│  • Coordinates across parallel sub-orchestrators (SendMessage)       │
│  • On sub-orchestrator success: verifies high-level outcome, marks   │
│    Status: 🟢, appends Revisions row, commits per milestone          │
│  • Spawns `hackathon-reviewer` after major features for review pass  │
│  • Does NOT write code · Does NOT plan milestone-internal Codex      │
│    units — that's the sub-orchestrator's job                         │
└─────────────────────┬────────────────────────────────────────────────┘
                      │ Agent tool spawn (subagent_type: "hackathon-dev")
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  hackathon-dev (sub-orchestrator) — one per milestone                │
│  • Receives ONE assigned milestone (e.g. "execute M0")               │
│  • Reads PLAN.md + MILESTONES.md milestone block + MOCK_DATA.md as   │
│    needed                                                            │
│  • Invokes `/shadcn` skill BEFORE writing any FE layout              │
│  • Plans the work as one or more Codex-sized prompts using           │
│    `codex:gpt-5-4-prompting` skill                                   │
│  • Spawns `codex:codex-rescue` per Codex unit                        │
│  • Verifies Codex output: runs                                       │
│      pnpm typecheck && pnpm lint && pnpm build                       │
│    plus manual click-through for UI work                             │
│  • Iterates Codex prompt if verification fails                       │
│  • Reports back to master with: success/blocker, files touched,      │
│    verification command output                                       │
│  • Does NOT write code directly                                      │
│  • Does NOT update MILESTONES.md status — master owns that           │
└─────────────────────┬────────────────────────────────────────────────┘
                      │ Agent tool spawn (subagent_type: "codex:codex-rescue")
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  codex:codex-rescue (code writer) — one per Codex prompt             │
│  • Receives a fully-shaped prompt: absolute path, files to modify,   │
│    acceptance criteria, verification command                         │
│  • Reads AGENTS.md from cwd upward (auto)                            │
│  • Writes file edits per the prompt                                  │
│  • Returns diff summary                                              │
│  • Does NOT run verification; sub-orchestrator does that             │
└──────────────────────────────────────────────────────────────────────┘
```

### When to spawn what

| Scenario | What master does |
|---|---|
| Single sequential milestone | Spawn ONE `hackathon-dev` with the milestone assignment |
| Multiple parallel-safe milestones in same phase | Spawn MULTIPLE `hackathon-dev` agents in a single message (independent assignments). Use `TeamCreate` if cross-coordination needed. |
| Review pass after major feature | Spawn ONE `hackathon-reviewer` on the diff. No team needed. |
| Code exploration / question | Use `dora-code-explorer` (read-only) or read directly. No `hackathon-dev` needed. |

### Master orchestrator workflow

1. **Pick** — read MILESTONES.md status board. Find the next milestone(s) with `Status: 🔘`, `blockedBy` cleared, in the current phase. Within a phase, batch parallel-safe milestones.
2. **Claim** — for each picked milestone, edit MILESTONES.md: status board row + milestone's own Status field both → `🟡`, Owner → `master`. Commit: `chore(milestones): claim M<N>` (or batch).
3. **Spawn** — call `Agent` tool with `subagent_type: "hackathon-dev"`, prompt containing:
   - Milestone ID and name
   - Absolute path: `/Users/abelramadhan/projects/belli-workspace/hackathon`
   - Pointer: "Read MILESTONES.md → M<N> for Files / Success criteria / Test criteria"
   - Pointer: "Read PLAN.md → <relevant section> for design context"
   - Pointer: "Read MOCK_DATA.md → <relevant section>" if M2 / fixture-touching
   - Verification command: `pnpm typecheck && pnpm lint && pnpm build`
   - Hard constraint: must invoke `/shadcn` skill before any FE layout
4. **Coordinate** — for parallel spawns, watch for cross-cutting questions; respond via `SendMessage`.
5. **Verify on return** — confirm sub-orchestrator's success claim is real:
   - Re-run verification command yourself
   - For UI work, open `localhost:3000` in browser, click through
   - Check the Files list in MILESTONES.md was actually touched (and only those files)
6. **Mark done** — edit MILESTONES.md: status board row + milestone Status → `🟢`, append Revisions row noting completion. Commit: `feat(M<N>): <summary>` (or `chore`/`fix` as appropriate).
7. **Review pass** — every 3-4 milestones or end of phase, spawn `hackathon-reviewer` on the diff before continuing.
8. **Loop** — back to step 1 for next milestone(s).

### Sub-orchestrator (hackathon-dev) workflow

The `hackathon-dev` agent definition (`.claude/agents/hackathon-dev.md`) already documents its loop. Master should not duplicate that knowledge in spawn prompts — just point at the assigned milestone and let the sub-orchestrator drive.

### Hard constraints across all layers

- Phase gates are sequential. Phase N+1 cannot start until ALL of Phase N is 🟢.
- Style guide is binding. OKLCH tokens via CSS vars, dark default via `next-themes`, Geist Mono everywhere, shadcn/ui primitives only. Use `cn()` from `lib/utils.ts`.
- IATA ONE Record v3.2 shapes are binding. Adapters normalise TO canonical shapes inside `/api/*` routes; subsystems consume only canonical shapes; never import `public/data/*.json` directly in subsystem code.
- DG AutoCheck: stub mode is the demo default. Do not enable real-mode env vars until M23 AND credentials provided.
- Mock data fixtures must satisfy MOCK_DATA.md → Validation rules. `scripts/validate-fixtures.ts` is the gate for M2.
- One commit = one milestone (with green tests). Don't batch multiple milestones into a single commit.
- Use `git -C /Users/abelramadhan/projects/belli-workspace/hackathon` for git commands.
- Never bypass safety: no `--no-verify`, no `git reset --hard`, no force-push without explicit user confirmation.

## Skills

Master orchestrator should use these directly during planning + verification:

- **`brainstorming`** — re-scope when adding/removing features
- **`writing-plans`** — break large tasks into Codex-sized units (rare at master layer; mostly delegated)
- **`verification-before-completion`** — never claim work done without running verify command and seeing it pass
- **`web-design-guidelines`** — review polish work (M20)
- **`superpowers:dispatching-parallel-agents`** — when spawning multiple `hackathon-dev` for the same phase

Sub-orchestrators have their own skill set declared in their agent definition. Don't duplicate.

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
- shadcn/ui components installed via `pnpm dlx shadcn@latest add <component>` — do NOT hand-roll buttons/inputs/cards.
- Compose styles with Tailwind utility classes; avoid CSS modules.
- Leaflet must be dynamic-imported with `ssr: false` (touches `window`).

### Desktop-first
The app is desktop-first. Mobile is not a target for the hackathon. No PWA install prompt. No mobile-emulation testing required.

### State & persistence
- Use Zustand stores in `lib/stores/` — one store per concern (uld-store, demo-clock-store, resources-store, inventory-store, dg-autocheck-store, etc.).
- Wrap `localStorage` access through `lib/persistence/local-prefs.ts` — never call `localStorage` directly in components.
- All persistence is best-effort — if storage fails, app must still work in-memory.

### Demo discipline
- All injectable demo events live behind `/dev/control` + `/dev/inject` (hidden in production via `NEXT_PUBLIC_DEMO_MODE` env).
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

For git: always `git -C /Users/abelramadhan/projects/belli-workspace/hackathon <cmd>`.

### Subagent Working Directory

Codex subagents start with a fresh shell — they do NOT inherit cwd. The `hackathon-dev` sub-orchestrator MUST embed the absolute path in any Codex prompt.

### Verification Discipline

- Never claim "done" without running `pnpm typecheck && pnpm lint && pnpm build` and seeing zero errors.
- Never claim a UI feature works without opening it in a browser and clicking through.
- Master orchestrator independently re-verifies sub-orchestrator success before marking milestone 🟢.

### Demo-Readiness Override

For the final 30 minutes before demo:
- No new features. Bug fixes only.
- Rehearse the full scripted timeline twice.
- Have a fallback: if live URL fails, open localhost. If localhost fails, open recorded video.

## What NOT to do

- Do not touch `belli/` or `belli-api/` — those are unrelated Belli prod code.
- Do not add a separate backend service. Next.js API routes are the BE; no DB.
- Do not pull in Clerk, TanStack Query, Liveblocks, or any other Belli-specific dependency that doesn't apply here.
- Do not write tests for the demo path — focus all time on working features. (Optional small tests for the PCM physics integrator + adapter unit tests are acceptable per M-level success criteria.)
- Do not optimize for production scale.
- Do not write code at the master orchestrator layer. Code writing is delegated all the way down to Codex.
- Do not enable DG AutoCheck real mode until M23 AND credentials provided.

## See Also

- `PLAN.md` — full design (architecture, data model, demo, design system)
- `MILESTONES.md` — live work breakdown + status board (canonical task list)
- `MOCK_DATA.md` — fixture plan + scenario impact matrix
- `AGENTS.md` — code conventions Codex auto-reads when invoked
- `style-guide.json` — design tokens (OKLCH, Geist Mono, dark default)
- `dg-autocheck-api/integration.md` — DG AutoCheck Connect API v1 integration guide (M23 only)
- `.claude/agents/hackathon-dev.md` — sub-orchestrator definition
- `.claude/agents/hackathon-reviewer.md` — reviewer definition
