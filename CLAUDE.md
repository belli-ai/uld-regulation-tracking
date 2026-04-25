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

Hierarchical multi-agent flow with **terminal-based parallelism via cmux**. Each sub-orchestrator runs as a fresh `claude` instance in its own cmux workspace — independent context window, independent conversation, independent crash blast radius.

```
┌─────────────────────────────────────────────────────────────────────┐
│  YOU (master orchestrator) — top-level Claude Code session          │
│  • Drives MILESTONES.md from all-🔘 to all-🟢                       │
│  • Picks the next milestone(s) from the status board                │
│  • Phase-gated: never starts Phase N+1 until all of Phase N is 🟢   │
│  • Claims milestones in MILESTONES.md (Status: 🟡, Owner: master)   │
│  • For each milestone (or batch of parallel-safe milestones):       │
│    spawns a fresh `claude` instance in a NEW cmux workspace and     │
│    feeds it the hackathon-dev kickoff prompt                        │
│  • Monitors progress via `cmux read-screen --scrollback`            │
│  • On DONE marker: independently re-verifies, marks 🟢, appends     │
│    Revisions row, commits per milestone, closes the workspace       │
│  • Spawns `hackathon-reviewer` via Agent tool (no cmux) every 3-4   │
│    milestones for review pass                                       │
│  • Does NOT write code · Does NOT plan Codex units                  │
└────────────────────┬────────────────────────────────────────────────┘
                     │ cmux new-workspace + claude + kickoff prompt
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  hackathon-dev teammate — `claude` running in a cmux workspace      │
│  • Receives ONE milestone assignment via the kickoff prompt         │
│  • Has its OWN context window (~200k tokens) — independent of       │
│    master's. Long milestones don't bloat master's history.          │
│  • Reads PLAN.md / MILESTONES.md / MOCK_DATA.md as the milestone    │
│    requires                                                         │
│  • Invokes `/shadcn` skill BEFORE writing any FE layout             │
│  • Plans Codex-sized prompts using `codex:gpt-5-4-prompting`        │
│  • Spawns `codex:codex-rescue` via Agent tool (in-session — Codex   │
│    is one-shot, no need for its own cmux)                           │
│  • Verifies: `pnpm typecheck && pnpm lint && pnpm build`            │
│    plus manual click-through for UI work                            │
│  • Iterates Codex prompt if verification fails                      │
│  • On success, prints exactly:  ===DONE M<N>===                     │
│    followed by files touched, last 20 lines of verify output, any   │
│    deviations from the milestone Files list                         │
│  • On hard block (2+ Codex failures), prints:  ===BLOCKED M<N>===   │
│    followed by diagnosis                                            │
│  • Does NOT touch MILESTONES.md status — master owns that           │
│  • Does NOT commit — master owns that                               │
└────────────────────┬────────────────────────────────────────────────┘
                     │ Agent tool (in-session in this cmux Claude)
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  codex:codex-rescue — single-shot code writer                       │
│  • Receives a fully-shaped prompt: absolute path, files to modify,  │
│    acceptance criteria, verification command                        │
│  • Reads AGENTS.md from cwd upward (auto)                           │
│  • Writes file edits, returns diff summary                          │
│  • Does NOT run verification; hackathon-dev does that               │
└─────────────────────────────────────────────────────────────────────┘
```

### Why cmux instead of nested Agent-tool spawns

- **Independent context windows.** Each hackathon-dev gets its own ~200k tokens. Master's context doesn't bloat with milestone-internal noise.
- **Visible parallelism.** User can switch tabs and watch each teammate work in real time.
- **Crash isolation.** A stuck/off-rails teammate stays contained in its workspace. Closing the tab removes it cleanly.
- **Native scale.** Phase 2 can run 7 hackathon-dev workspaces concurrently without context contention.
- **Reviewer stays Agent-tool.** `hackathon-reviewer` is one-shot and read-only — cmux overhead unjustified.

### Spawn protocol (master-side)

For each milestone (or batch of parallel-safe milestones), run this script. Refs are monotonically incrementing, so always re-resolve via `cmux list-workspaces`.

```bash
# 1. Create workspace, capture UUID
UUID=$(cmux new-workspace 2>&1 | awk '{print $2}')
sleep 3                         # zsh / oh-my-zsh init

# 2. Resolve current ref
REF=$(cmux list-workspaces 2>&1 | grep "$UUID" | awk '{print $1}')

# 3. Rename tab for visibility
cmux rename-workspace --workspace "$REF" "M<N>: <short title>"

# 4. cd into project root and launch claude
cmux send --workspace "$REF" 'cd /Users/abelramadhan/projects/belli-workspace/hackathon && claude'
cmux send-key --workspace "$REF" enter
sleep 5                         # claude init

# 5. Send the hackathon-dev kickoff prompt (single line; long prompt OK — typed char-by-char)
cmux send --workspace "$REF" '<HACKATHON-DEV KICKOFF PROMPT — see below>'
cmux send-key --workspace "$REF" enter
```

### hackathon-dev kickoff prompt template

Sent via `cmux send` to each spawned cmux Claude. Substitute `<N>` and the relevant section pointers per milestone.

```
You are hackathon-dev sub-orchestrator for milestone M<N>.

REQUIRED READS:
- CLAUDE.md → Implementation Team Structure (your role)
- MILESTONES.md → M<N> block (Files, Success criteria, Test criteria)
- PLAN.md → <relevant section names>
- MOCK_DATA.md → <relevant sections> (only if M<N> touches fixtures)
- AGENTS.md → Codex code conventions
- style-guide.json (only if M<N> involves FE layout)

MANDATORY: Before writing any FE layout code, invoke the /shadcn skill.

WORKFLOW:
1. Read the milestone block. Confirm scope.
2. Plan Codex-sized prompts using codex:gpt-5-4-prompting skill.
3. Spawn codex:codex-rescue via Agent tool per Codex unit.
4. Verify: pnpm typecheck && pnpm lint && pnpm build
   plus milestone-specific tests (e.g. pnpm tsx scripts/validate-fixtures.ts).
5. For UI work, open localhost:3000, click through.
6. If verification fails, iterate the Codex prompt. After 2 failures
   on the same Codex spawn, stop and emit ===BLOCKED M<N>=== with diagnosis.
7. On green, emit exactly:
     ===DONE M<N>===
     Files touched: <list>
     Verify output (last 20 lines): <paste>
     Deviations from milestone Files list: <none | list with reasons>

DO NOT update MILESTONES.md status. Master owns that.
DO NOT commit. Master owns that.
DO NOT touch files outside the milestone Files list without flagging
in your DONE/BLOCKED report.
```

### Monitoring + completion detection (master-side)

```bash
# Poll the workspace screen for completion markers
cmux read-screen --workspace "$REF" --scrollback | tail -80 | grep -E "^===(DONE|BLOCKED) M<N>==="
```

When the marker appears: read the full DONE/BLOCKED block via `cmux read-screen --workspace "$REF" --scrollback`, then proceed to verify + mark done + commit + close workspace.

### When to spawn what

| Scenario | What master does |
|---|---|
| Single sequential milestone | Spawn 1 cmux workspace, send hackathon-dev kickoff |
| Multiple parallel-safe milestones in same phase | Spawn N cmux workspaces (run the spawn script N times in one Bash batch). Each gets its own kickoff prompt. |
| Review pass after major feature | Spawn `hackathon-reviewer` via **Agent tool** (no cmux — read-only, one-shot) |
| Code exploration / question | Use `dora-code-explorer` Agent tool or read directly. No cmux. |

### Coordination across parallel cmux teammates

Parallel hackathon-dev workspaces can NOT share TaskList or SendMessage (separate Claude processes). Master is the only coordination layer:

- **File conflicts**: prevented by per-milestone Files list discipline. Two parallel milestones must never list the same file.
- **Cross-cutting questions**: master reads workspace A's screen, decides answer, sends to workspace A via `cmux send`.
- **Cross-milestone info**: if WS-A learns something WS-B needs, master relays via `cmux send`.

### Master orchestrator workflow

1. **Pick** — read MILESTONES.md status board. Identify next milestone(s) with `Status: 🔘`, `blockedBy` cleared. Within a phase, batch parallel-safe milestones.
2. **Claim** — edit MILESTONES.md: status board row + milestone's own Status → `🟡`, Owner → `master`. Commit `chore(milestones): claim M<N>` (or batch).
3. **Spawn cmux workspace(s)** — one per claimed milestone. Run the spawn script. Send the hackathon-dev kickoff prompt.
4. **Monitor** — poll `cmux read-screen --scrollback` for DONE/BLOCKED markers. Use the Monitor tool with an `until` loop if available, otherwise manual poll every 60-120s.
5. **Re-verify on DONE** — independently in master's terminal, run `pnpm typecheck && pnpm lint && pnpm build`. For UI work, open localhost:3000, click through.
6. **Mark done** — edit MILESTONES.md (Status → 🟢), append Revisions row. Commit `feat(M<N>): <summary>` (or `chore`/`fix`/`refactor`).
7. **Close workspace** — `cmux close-workspace --workspace "$REF"` to clean up the tab.
8. **Review pass** — every 3-4 milestones or at end of phase, spawn `hackathon-reviewer` (Agent tool, not cmux) on the diff since last review.
9. **Loop** — back to step 1.

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
