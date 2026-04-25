# Milestones — Cool-Chain Copilot

Implementation plan for the project described in **PLAN.md**. 23 milestones across 4 phases, designed for multi-agent parallel execution: most subsystem work in Phase 2 and most UI work in Phase 3 are independent and can run concurrently when their phase-gate is clear.

> **Source of truth**: this file tracks live milestone status and revisions. **PLAN.md** describes the design and is intentionally kept stable; cite section names from PLAN.md (e.g. _"see PLAN.md → Data Models"_) when a milestone references design content.

## Plan Revisions

Tracks structural changes to this Milestones plan. Per-milestone revisions live inside each milestone block.

| Rev | Date       | Author | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0 | 2026-04-25 | Lead   | Initial 23-milestone breakdown across 4 phases — multi-agent parallel-safe markers, success criteria, test criteria, per-milestone revisions tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.1 | 2026-04-25 | Lead   | Design system locked: Next.js 15 + Tailwind v4 + shadcn/ui + OKLCH tokens + Geist Mono + dark default. M0 expanded with token bootstrapping, theme provider, expanded shadcn primitive list. See `style-guide.json` and PLAN.md → **Design System** for the contract.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1.2 | 2026-04-25 | Lead   | Mock data plan locked: `MOCK_DATA.md` is now source of truth for fixtures (4 flights, 13 AWBs incl. 2 DG placeholders, 12 ULDs with 7-tracker/5-passive split, 7 IoT devices, DXB geofence 8 sub-zones). M2 file list expanded with `iot-devices.json` + `dg-declarations.json`; success criteria tightened to enforce SHC coverage, tracker-split, DG path, cross-fixture ID resolution.                                                                                                                                                                                                                                                                                                      |
| 1.3 | 2026-04-25 | Lead   | Free map provider committed: react-leaflet + CartoDB Dark Matter (dark) / Voyager (light) / OSM raw (fallback) raster tiles. **No API key required.** Airport coordinates added (DXB + 4 arrivals) for great-circle in-flight visualisation. PLAN.md grew **Map / Geo Visualisation** section. M2 added `airports.json`. M14 expanded with attribution, theme-aware tiles, flight-overview map, SSR-disabled dynamic import.                                                                                                                                                                                                                                                                   |
| 1.4 | 2026-04-25 | Lead   | Cohesion review: fixed mechanical gaps. M19 file list added missing `time-of-day-change.ts` + `alert.ts` event handlers (matching PLAN.md → Demo Control Panel event types). M14 component ownership table added `flight-overview-map.tsx`. M0 deps added `tsx`. M5 success criteria split into tracker-equipped vs passive-ULD inference paths. M8 success criteria added passive-ULD skip. M3 success criteria added concrete DG stub rule table. MOCK_DATA: AKH ULDs now reference `AKH_HORSE_STALL` product code (not Generic passive). Added `ENVIROTAINER_RKN_FRO` product spec; RKN-99002EK retyped to FRO so the FRO AWB has a compatible ULD. AWB → ULD compatibility map documented. |
| 1.5 | 2026-04-25 | Lead   | Clarifications resolved (Q1, Q2, Q3): **Q1** DG flow = pre-issued by shipper, build-up validates only — M9 contract changed from `dgChecker.check` to `dgChecker.validate` returning `{ status: 'non-dg' \| 'valid' \| 'rejected', declaration?, reason? }`. M3 stub rule table updated to look up by piece IRI. **Q2** PLAN.md Demo Scenario prose table aligned 1:1 with `dxb-warehouse-demo` JSON event timeline (15 rows, t=0–180s). **Q3** scenarios.json validated by Zod schema in `lib/simulator/scenario-schema.ts` (M2 owner, M19 importer); `zod` added to M0 deps.                                                                                                                 |
| 1.6 | 2026-04-25 | Lead   | DG API spec received (Q4+Q5 partial): **DG AutoCheck Connect API v1** at `dg-autocheck-api/`. Async workflow (create → upload → user-verify-in-vendor-UI → webhook). M23 fully rewritten with concrete endpoint mappings, OAuth client, webhook listener with SHA-256 signature verification, modal iframe, status polling fallback, env var contract, and explicit stub-vs-autocheck mode toggle (stub stays demo default). PLAN.md → Build-Up Flow updated with two-mode semantics. MOCK_DATA → DG section reframed: stub fixtures = post-AutoCheck cache shape. M23 hours bumped 2 → 6. Pending: DGAC sandbox credentials.                                                                  |

## How agents work this plan

- **Phase gates are sequential.** Phase N+1 cannot start until every milestone in Phase N is `🟢 Done` (unless a milestone is explicitly marked `Parallel-safe: cross-phase`).
- **Within a phase, parallel-safe milestones run concurrently.** Each milestone has a `Parallel-safe` field saying yes/no and why.
- **Claim a milestone** by editing its **Status** to `🟡 In progress` and **Owner** to your agent name. Commit that change before starting work so other agents see it.
- **Block tracking**: when blocked, set Status to `🔴 Blocked` and append a row to the milestone's **Revisions** table with the blocker description.
- **Done definition**: every **Success criteria** box ticked + every **Test criteria** box ticked + the orchestrator has verified the diff against the milestone scope.
- **Revisions to scope/criteria**: every change to a milestone's success criteria, test criteria, files, or scope must append a row in that milestone's **Revisions** table with date and reason. Architectural or cross-cutting revisions go in the top-level **Plan Revisions** table at the top of this file.
- **File conflicts**: if two agents need to touch overlapping files, the second agent waits for the first to mark Done, or coordinates a hand-off via the team channel. Per-milestone **Files** lists are the contract for ownership.
- **Status legend**: 🔘 Not started · 🟡 In progress · 🟢 Done · 🔴 Blocked.

## Phase overview

| Phase                         | Milestones                                          | Concurrency                                                    | Gate to next phase            |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------- | ----------------------------- |
| **Phase 1 — Foundation**      | M0 → M1 → (M2 ∥ M3)                                 | Sequential through M1, then M2 + M3 in parallel                | All Phase 1 ✅ before Phase 2 |
| **Phase 2 — Core subsystems** | M4 ∥ M5 ∥ M6 ∥ M7 ∥ M8 ∥ M9 ∥ M10                   | All parallel (independent TS modules, no shared UI)            | All Phase 2 ✅ before Phase 3 |
| **Phase 3 — UI screens**      | M11 ∥ M12 ∥ M13 ∥ M14 ∥ M15 ∥ M16 ∥ M17 ∥ M18 ∥ M19 | Mostly parallel — each owns a route or component cluster       | All Phase 3 ✅ before Phase 4 |
| **Phase 4 — Polish & demo**   | M20 → M21 → M22                                     | Sequential                                                     | —                             |
| **Cross-phase**               | M23 (Real DG API swap)                              | Triggered by external spec arrival; can land any time after M3 | —                             |

## Milestone status board

Quick-glance status. Each row points to the detailed milestone block below. Update both this row and the milestone's own status when claiming/completing.

| ID  | Title                                        | Phase | Status | Owner  | Parallel-safe | Blocked by |
| --- | -------------------------------------------- | ----- | ------ | ------ | ------------- | ---------- |
| M0  | Project scaffold                             | 1     | 🟢     | master | No            | —          |
| M1  | IATA ONE Record TS types                     | 1     | 🟢     | master | No            | M0         |
| M2  | Mock data fixtures                           | 1     | 🟡     | master | Yes (∥ M3)    | M1         |
| M3  | API route adapter layer                      | 1     | 🟡     | master | Yes (∥ M2)    | M1         |
| M4  | Physics engine                               | 2     | 🔘     | —      | Yes           | Phase 1    |
| M5  | State inference (5-stage)                    | 2     | 🔘     | —      | Yes           | Phase 1    |
| M6  | Action recommender + ranker                  | 2     | 🔘     | —      | Yes           | Phase 1    |
| M7  | Push-time scheduler                          | 2     | 🔘     | —      | Yes           | Phase 1    |
| M8  | Tracker simulator                            | 2     | 🔘     | —      | Yes           | Phase 1    |
| M9  | Build-up flow logic                          | 2     | 🔘     | —      | Yes           | Phase 1    |
| M10 | Audit DB (Dexie)                             | 2     | 🔘     | —      | Yes           | Phase 1    |
| M11 | Flight list page (`/`)                       | 3     | 🔘     | —      | Yes           | Phase 2    |
| M12 | Flight workspace (`/flight/[no]`)            | 3     | 🔘     | —      | Yes           | Phase 2    |
| M13 | Build-up canvas (`/flight/[no]/build/[uld]`) | 3     | 🔘     | —      | Yes           | Phase 2    |
| M14 | ULD detail (`/uld/[id]`)                     | 3     | 🔘     | —      | Yes           | Phase 2    |
| M15 | Supervisor dashboard (`/supervisor`)         | 3     | 🔘     | —      | Yes           | Phase 2    |
| M16 | Excursion + Resolution logs                  | 3     | 🔘     | —      | Yes           | Phase 2    |
| M17 | Audit timeline + deviation report            | 3     | 🔘     | —      | Yes           | Phase 2    |
| M18 | Admin config (`/admin/config`)               | 3     | 🔘     | —      | Yes           | Phase 2    |
| M19 | Scenario runner + Demo control panel         | 3     | 🔘     | —      | Yes           | Phase 2    |
| M20 | Polish — notifications, theming, charts      | 4     | 🔘     | —      | No            | Phase 3    |
| M21 | Pitch deck                                   | 4     | 🔘     | —      | No            | M20        |
| M22 | End-to-end rehearsal & bug fixes             | 4     | 🔘     | —      | No            | M21        |
| M23 | Real DG API integration swap                 | ×     | 🔘     | —      | Cross-phase   | M3 + spec  |

---

## Phase 1 — Foundation

### M0 — Project scaffold

| Field           | Value                     |
| --------------- | ------------------------- |
| Status          | 🟢 Done                   |
| Owner           | master                    |
| Phase           | 1                         |
| Parallel-safe   | No (single root scaffold) |
| Blocked by      | —                         |
| Blocks          | M1, M2, M3                |
| Estimated hours | 1.5                       |

**Files**

- `package.json`, `pnpm-lock.yaml`
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`
- `app/layout.tsx` (loads Geist Mono via `next/font/google`, wraps in `next-themes` ThemeProvider, default dark)
- `app/page.tsx` (placeholder using shadcn primitives — verifies tokens render)
- `app/globals.css` (Tailwind v4 `@import "tailwindcss"` + `@theme` block defining OKLCH tokens for both themes per style-guide.json + custom keyframes `fadeInSlideRight`, `fadeInSlideLeft`, `heroValuePulse`)
- `components.json` (shadcn config — style: default, baseColor: neutral, css var: yes)
- `lib/utils.ts` (`cn()` helper — clsx + tailwind-merge)
- `components/theme-provider.tsx` (next-themes wrapper)
- `.gitignore`, `.env.local.example`, `vercel.json`
- `style-guide.json` (already exists — referenced, not modified)
- `components/ui/*` (shadcn install: button, card, dialog, badge, input, table, tabs, scroll-area, separator, toast, switch, progress, checkbox, dropdown-menu, popover)

**Success criteria**

- [ ] `pnpm dev` runs on `localhost:3000` with no errors
- [ ] `pnpm build` completes successfully
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (eslint with Next.js 15 + TS strict configured)
- [ ] **Next.js 15** installed (`next@^15`)
- [ ] **Tailwind v4** installed (`tailwindcss@^4`, `@tailwindcss/postcss`)
- [ ] **Geist Mono** loaded via `next/font/google`, `--font-geist-mono` CSS var available, `font-mono` Tailwind utility resolves to it
- [ ] **OKLCH tokens** defined in `app/globals.css` `@theme` block matching `style-guide.json` for both light + dark themes; tokens consumed via `bg-card`, `text-foreground`, `border-border`, etc.
- [ ] **next-themes** integrated, default theme `dark`, `data-theme` attribute on `<html>`
- [ ] **tw-animate-css** installed and imported in `globals.css`
- [ ] **class-variance-authority**, **clsx**, **tailwind-merge** installed; `cn()` exported from `lib/utils.ts`
- [ ] **lucide-react** installed
- [ ] shadcn/ui primitives installed (button, card, dialog, badge, input, table, tabs, scroll-area, separator, toast, switch, progress, checkbox, dropdown-menu, popover) — `pnpm dlx shadcn@latest add ...`
- [ ] Dependencies installed: `zustand`, `@turf/turf`, `recharts`, `react-leaflet`, `leaflet`, `dexie`, `date-fns`, `next-themes`, `zod` (scenario schema runtime validation), `tsx` (devDep, used by `validate-fixtures.ts`)
- [ ] Vercel deployment of the placeholder page succeeds (live URL accessible)
- [ ] `NEXT_PUBLIC_DEMO_MODE` env var read in app layout to gate `/dev/*` routes
- [ ] Placeholder `app/page.tsx` renders one of each shadcn primitive (button default + outline + ghost; card; badge; input) — proves tokens flow through correctly in both light + dark

**Test criteria**

- [ ] `pnpm typecheck && pnpm lint && pnpm build` exits 0
- [ ] Visiting Vercel URL returns 200 with the placeholder page rendered, default dark theme
- [ ] Toggling theme to light flips backgrounds/foregrounds correctly (manual via DevTools or theme toggle)
- [ ] Geist Mono visible on placeholder text (check via DevTools computed font-family)
- [ ] Visiting `/dev/control` in production with `NEXT_PUBLIC_DEMO_MODE !== 'true'` returns 404
- [ ] Sample button shows orange primary (`oklch(0.646 0.222 41.116)` light / `oklch(0.705 0.213 47.604)` dark) and the focus ring `ring-[3px]` is visible on Tab

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |
| 2026-04-25 | Added design-system bootstrapping: Next.js 15, Tailwind v4, OKLCH tokens, next-themes (dark default), Geist Mono, tw-animate-css, cva, expanded shadcn primitive list to match style-guide.json | Lead |
| 2026-04-25 | Completed by master + hackathon-dev. All 15 shadcn primitives installed (`sonner` substituted for deprecated `toast`). Next 15.5.15 + Tailwind 4.2.4 + Geist Mono + OKLCH dark default verified. Added `eslint.config.mjs` + `@eslint/eslintrc` (Next 15 flat-config standard) and `lib/env.ts` (env-gate helper) — not in original Files list. Added `app/dev/{layout,page}.tsx` as gate-test target (404s when `NEXT_PUBLIC_DEMO_MODE !== 'true'`). Vercel deploy NOT executed (no CLI auth in agent session) — flagged as outstanding follow-up. Verification: `pnpm typecheck && pnpm lint && pnpm build` all exit 0, 5/5 static pages. | master |

### M1 — IATA ONE Record TypeScript types

| Field           | Value                            |
| --------------- | -------------------------------- |
| Status          | 🟢 Done                          |
| Owner           | master                           |
| Phase           | 1                                |
| Parallel-safe   | No (single source-of-truth file) |
| Blocked by      | M0                               |
| Blocks          | M2, M3, all of Phase 2           |
| Estimated hours | 1                                |

**Files**

- `lib/ontology/one-record.ts`
- `lib/ontology/__fixtures__/sample-objects.ts`

**Success criteria**

- [ ] All ontology classes from PLAN.md → **Data Models** have a TypeScript interface (ULD, Piece, Waybill, Shipment, TransportMovement, Booking, IotDevice, Sensor, Measurement, LogisticsEvent, LogisticsAction, Loading, Storing, DgDeclaration, TemperatureInstructions, Location, Address, Geolocation, Party, Carrier, Organization)
- [ ] Each interface declares `@id: IRI` and `@type` discriminated string literals
- [ ] `IRI` type alias exported (string brand)
- [ ] Discriminated unions where relevant (`AnyLogisticsAction = LogisticsAction | Loading | Storing`)
- [ ] No use of `any` (no exceptions)
- [ ] Each interface has a `/** @see https://onerecord.iata.org/ns/cargo#X */` JSDoc tag pointing back to its IATA class IRI

**Test criteria**

- [ ] `pnpm typecheck` passes
- [ ] `lib/ontology/__fixtures__/sample-objects.ts` exports one valid sample of every interface; file type-checks clean
- [ ] Type narrowing test: a function `function isLoading(a: AnyLogisticsAction): a is Loading` narrows correctly

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |
| 2026-04-25 | Completed by master + m1-dev (team `cool-chain-foundation`). `lib/ontology/one-record.ts` (6.4K) + `lib/ontology/__fixtures__/sample-objects.ts` (8.5K) created. Verification: `pnpm typecheck && pnpm lint && pnpm build` all exit 0. | master |

### M2 — Mock data fixtures (IATA-shaped)

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Status          | 🟡 In progress                                                         |
| Owner           | master                                                                 |
| Phase           | 1                                                                      |
| Parallel-safe   | Yes (∥ M3, no overlapping files)                                       |
| Blocked by      | M1                                                                     |
| Blocks          | M3 (the routes that load these), Phase 2 (subsystems read via /api/\*) |
| Estimated hours | 2                                                                      |

**Source of truth**: [`MOCK_DATA.md`](./MOCK_DATA.md). Every fixture in this milestone implements the concrete entities, IDs, and cross-references defined there. The scenario impact matrix in MOCK_DATA.md is the contract for which AWBs / ULDs / trackers / zones each scenario exercises.

**Files**

- `public/config/shc.json` (per PLAN.md → SHC Config)
- `public/config/stations.json` (single station DXB; capabilities per MOCK_DATA.md → Stations)
- `public/config/uld-specs.json` (5 product types per MOCK_DATA.md → ULD Product Specs)
- `public/data/weather/DXB.json` (mock fallback curve per MOCK_DATA.md → Weather)
- `public/data/airports/DXB.geojson` (8 sub-zones per MOCK_DATA.md → DXB Geofence)
- `public/data/airports.json` (5 airport coordinates: DXB + FRA + LHR + JFK + SIN per MOCK_DATA.md → Airport coordinates)
- `public/data/flights.json` (4 flights per MOCK_DATA.md → Flights)
- `public/data/shipments.json` (13 AWBs per MOCK_DATA.md → Shipments / AWBs, with SHC mix and DG placeholders)
- `public/data/uld-inventory.json` (12 ULDs, 7-with-tracker / 5-passive split per MOCK_DATA.md → ULD Inventory)
- `public/data/iot-devices.json` (7 IoT devices + 28 sensors per MOCK_DATA.md → IoT Devices & Sensors)
- `public/data/dg-declarations.json` (2 DG placeholders per MOCK_DATA.md → DG mapping placeholder)
- `public/data/scenarios.json` (4 scenarios: `dxb-warehouse-demo`, `dxb-quiet-shift`, `dxb-cascading-delays`, `custom`)
- `lib/simulator/scenario-schema.ts` (Zod schema for scenario shape — owned here, imported by M19 runtime + validate-fixtures)
- `scripts/validate-fixtures.ts` (enforces MOCK_DATA.md → Validation rules; uses Zod schema for `scenarios.json`)

**Success criteria**

- [ ] Every fixture file matches the entity tables in MOCK_DATA.md (IDs, counts, SHC mix, tracker split)
- [ ] Every JSON file structurally matches its corresponding TS interface from M1
- [ ] At least one COL, one PER, one AVI, one CRT, one FRO, one HEG AWB present across `shipments.json` (full SHC coverage)
- [ ] At least one tracker-equipped ULD AND at least one passive ULD present
- [ ] At least one DG-declared AWB present (placeholder DGD payload)
- [ ] `DXB.geojson` has all 8 named features per MOCK_DATA.md → DXB Geofence with `referenceAmbientDeltaC` properties
- [ ] `scenarios.json` validates: every `flights[]`, `ulds[]`, `events[].uld_id` reference resolves to an existing fixture entity
- [ ] Cross-fixture invariants hold (every ULD's `iotDeviceId` resolves; every `uldProductCode` exists in `uld-specs.json`; every DG-declared piece has a resolvable `dgDeclaration` IRI)

**Test criteria**

- [ ] `pnpm tsx scripts/validate-fixtures.ts` parses every JSON, types it against M1 interfaces, runs the MOCK_DATA.md → Validation rules checklist, exits 0
- [ ] Manual visual inspection of `DXB.geojson` in geojson.io renders all 8 sub-zone features inside DXB airport bounds
- [ ] Manual: each scenario in `scenarios.json` plays through M19 scenario runner stub without unresolved entity errors (smoke test deferred until M19 lands; for M2 acceptance, the ID-resolution check in `validate-fixtures.ts` is sufficient)

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |
| 2026-04-25 | Locked to MOCK_DATA.md as source of truth. Added `iot-devices.json` + `dg-declarations.json` to file list. Expanded SHC coverage to all six (added FRO, HEG). Added tracker-split + DG-coverage success criteria. Hours bumped 1.5 → 2 to absorb the iot-devices and dg-declarations file work. | Lead |

### M3 — API route adapter layer

| Field           | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Status          | 🟡 In progress                                                                              |
| Owner           | master                                                                                      |
| Phase           | 1                                                                                           |
| Parallel-safe   | Yes (∥ M2; M3 routes that need fixtures depend on M2 landing first or use stubs in interim) |
| Blocked by      | M1                                                                                          |
| Blocks          | Phase 2 (subsystems fetch from /api/\*), M19, M23                                           |
| Estimated hours | 2                                                                                           |

**Files**

- `app/api/flights/route.ts`
- `app/api/flights/[flightNo]/shipments/route.ts`
- `app/api/uld-inventory/route.ts`
- `app/api/dg/check/route.ts` (stub — rule-table-based; documented "real DG API swap point")
- `app/api/weather/route.ts` (Open-Meteo proxy + mock fallback)
- `lib/adapters/flights.ts`
- `lib/adapters/shipments.ts`
- `lib/adapters/uld-inventory.ts`
- `lib/adapters/dg-check.ts`
- `lib/adapters/weather.ts`
- `lib/adapters/__tests__/*.test.ts`

**Success criteria**

- [ ] All 5 API routes return canonical IATA shapes per M1 interfaces
- [ ] `/api/weather` falls back to mock JSON within 3s if Open-Meteo unreachable; response carries `source: 'live'|'mock'`
- [ ] `/api/dg/check` POST accepts `{ pieces: Piece[], departure: Location, arrival: Location, flight?: { flightNumber, aircraftCategory: 'passenger'|'cargo' } }` and returns `{ results: DgValidationResult[] }` where `DgValidationResult = { pieceIri, status: 'non-dg'|'valid'|'rejected', declaration?: DgDeclaration, reason?: string }`. **Validation contract, not issuance**: looks up pre-issued DGDs in `dg-declarations.json` by piece IRI.
- [ ] Stub rule table:
  - Piece IRI not present in `dg-declarations.json` → `{ status: 'non-dg' }`
  - Piece IRI present, DGD's `aircraftLimitationInformation` does NOT contain "cargo aircraft only" → `{ status: 'valid', declaration }`
  - Piece IRI present, DGD's `aircraftLimitationInformation` contains "cargo aircraft only" AND flight aircraftCategory is passenger → `{ status: 'rejected', declaration, reason: 'CAO-only DG on passenger aircraft' }`
  - Piece IRI present, CAO and flight is cargo → `{ status: 'valid', declaration }`
- [ ] Replaced by real rules at M23 (when hackathon DG API spec wires up).
- [ ] Each adapter has at least one unit test against an M2 fixture
- [ ] Adapters never leak external-source-specific fields into canonical shape (one-way mapping)
- [ ] `dg-check.ts` adapter contains a TODO marker at the swap point so M23 can find it instantly

**Test criteria**

- [ ] `curl localhost:3000/api/flights` returns valid `TransportMovement[]` JSON
- [ ] `curl localhost:3000/api/flights/EK0083/shipments` returns `Waybill[]` with `pieces` populated
- [ ] `curl localhost:3000/api/uld-inventory` returns `ULD[]` with `serviceabilityCode` field
- [ ] `curl -X POST localhost:3000/api/dg/check -H 'content-type: application/json' -d '{...sample...}'` returns `{ declarations: DgDeclaration[] }`
- [ ] `curl localhost:3000/api/weather?airport=DXB` returns `{ source: 'live'|'mock', ambient: [...] }`
- [ ] Adapter unit tests pass: `pnpm test lib/adapters`

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

---

## Phase 2 — Core subsystems

All M4–M10 are parallel-safe within Phase 2. Each is a pure-TS module with no UI; agents claim independently. Each milestone reads from `/api/*` or its `/lib/adapters/*` for input data — **do not import directly from `public/data/*.json`** in subsystem code.

### M4 — Physics engine (PCM digital twin)

| Field           | Value                                     |
| --------------- | ----------------------------------------- |
| Status          | 🔘 Not started                            |
| Owner           | —                                         |
| Phase           | 2                                         |
| Parallel-safe   | Yes                                       |
| Blocked by      | Phase 1                                   |
| Blocks          | M9 (build-up budget pre-flight), M14, M15 |
| Estimated hours | 1.5                                       |

**Files**

- `lib/physics/pcm-model.ts`
- `lib/physics/uld-specs-loader.ts`
- `lib/physics/__tests__/pcm-model.test.ts`

**Success criteria**

- [ ] `integrateBudget(uldSpec, T_internal_now, ambientCurve, dt) => { budgetSec, breachAt }` exported
- [ ] PCM phase-change absorption modeled (not just lumped mass): `pcmAbsorption(T, spec)` returns non-zero between `spec.pcmMeltStart` and `spec.pcmMeltEnd`
- [ ] At least 3 ULD specs loaded from `uld-specs.json` (Envirotainer RAP-COL, va-Q-tainer XL, Sonoco Pegasus CRT)
- [ ] Inputs typed against `:Measurement[]` ambient curve and `:TemperatureInstructions` for breach threshold

**Test criteria**

- [ ] Unit: cold ULD (4°C) in cool warehouse (20°C) → `budgetSec` >= 24h
- [ ] Unit: COL ULD in 45°C ambient sustained → breach within rated autonomy hours ±10%
- [ ] Unit: PCM phase-change inflection visible in temperature curve trace
- [ ] Unit: ambientCurve with cooling sub-window shows budget extending vs constant-hot baseline

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M5 — State inference (5-stage classifier)

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 2              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 1        |
| Blocks          | M14, M15, M19  |
| Estimated hours | 1.5            |

**Files**

- `lib/inference/state-classifier.ts`
- `lib/inference/airport-polygons-loader.ts`
- `lib/inference/__tests__/state-classifier.test.ts`

**Success criteria**

- [ ] `classifyState(uldId, recentMeasurements, polygons): { stage, internalSubState, confidence, source }` exported
- [ ] 5 surface stages: `in-warehouse`, `in-tarmac`, `in-flight`, `arrived-tarmac`, `arrived-destination`
- [ ] Internal sub-states tracked for warehouse (`cool-room` vs `ambient`) and tarmac (`loading` vs `staging`)
- [ ] Method (tracker-equipped ULDs): turf `booleanPointInPolygon` against DXB sub-zones + ambient-delta vs reference cool-room temp + dwell pattern. `source: 'measured'`.
- [ ] Method (passive ULDs, no measurements): bootstrap from `lastKnownLocation` + `lastKnownInternalC` in `uld-inventory.json`; advance via scenario events (`uld_state_force`) only. `source: 'inferred'` with confidence ≤ 0.6.
- [ ] Emits a `:LogisticsEvent` with the appropriate `eventCode` (`STATE_WAREHOUSE_IN`, `STATE_TARMAC_IN`, `STATE_FLIGHT_IN`, `STATE_TARMAC_DEST_IN`, `STATE_DEST_WAREHOUSE_IN`) on transition

**Test criteria**

- [ ] Unit: GPS inside `cool-room` polygon + ambient ≈ 5°C → `in-warehouse` / `cool-room`
- [ ] Unit: GPS inside `apron` polygon + ambient ≈ 40°C → `in-tarmac` / `staging`
- [ ] Unit: GPS far from DXB + altitude > 0 → `in-flight`
- [ ] Unit: state transition emits one `LogisticsEvent` per crossing, not per measurement

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M6 — Action recommender + ranker

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 2              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 1        |
| Blocks          | M14, M19       |
| Estimated hours | 2              |

**Files**

- `lib/recommender/action-library.ts` (~25 actions, no transit-specific T1-T7)
- `lib/recommender/ranker.ts`
- `lib/recommender/filters.ts`
- `lib/recommender/__tests__/*.test.ts`

**Success criteria**

- [ ] Action library exports ~25 entries matching the **Action Library** table in PLAN.md
- [ ] Each action has: `id`, `category`, `label`, `benefitHours: [min,max]`, `costTier`, `authority`, `executionMinutes`, `requiresStationCapability[]`, `applicableStates[]`, `applicableShc[]`
- [ ] `recommendActions(uldContext, station, resources): RankedAction[]` returns top-3
- [ ] Ranking formula: `(thermalBenefit × timeBuffer) / (cost × executionMin × disruption)`
- [ ] Always includes a `Document (no-mitigation fallback)` entry in the result list when no physical option is viable
- [ ] Each `RankedAction` carries a `materialiseAsLogisticsAction(): LogisticsAction` helper

**Test criteria**

- [ ] Unit: COL ULD in `in-tarmac` state at DXB with 2 free cool dollies → top-3 includes "Use refrigerated cool dolly" and "Park in jet-bridge shadow"
- [ ] Unit: AVI ULD with 0 free cool dollies → cool-dolly action filtered out
- [ ] Unit: action whose `executionMinutes > timeToBreach` is filtered out
- [ ] Unit: `materialiseAsLogisticsAction()` returns a valid `:LogisticsAction` per M1

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M7 — Push-time scheduler

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 2              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 1        |
| Blocks          | M12, M15       |
| Estimated hours | 1.5            |

**Files**

- `lib/scheduler/push-time.ts`
- `lib/scheduler/shc-loader.ts`
- `lib/scheduler/__tests__/push-time.test.ts`

**Success criteria**

- [ ] `pushTime(uldContext, flight, ambientForecast, shcConfig): { pushTime, maxWaitAir, holdDecision, reason }` exported
- [ ] Reads SHC entry → `:TemperatureInstructions` + `maxWaitMinutes` curve via `shc-loader`
- [ ] `linearInterpolate` for max-wait at arbitrary ambient °C
- [ ] Recompute cadence: 5-sec real-time tick OR immediate on event (flight delay, ambient revision)
- [ ] Hold/release surfaces in flight workspace as a card; supervisor dashboard shows aggregated hold list

**Test criteria**

- [ ] Unit: AVI ULD at 38°C airside ambient → max-wait = interpolated value between ambient35c and ambient40c entries
- [ ] Unit: COL ULD with 90-min flight delay → push-time shifts by delta with safety-margin retained
- [ ] Unit: hold-decision flips correctly when max-wait < (now → push + tow)

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M8 — Tracker simulator

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 2              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 1        |
| Blocks          | M14, M15, M19  |
| Estimated hours | 1.5            |

**Files**

- `lib/simulator/tracker-feed.ts`
- `lib/simulator/__tests__/tracker-feed.test.ts`

**Success criteria**

- [ ] `startTrackerFeed(uldId, scenarioParams)` returns a stream/observable emitting `:Measurement[]` at 10-min logical cadence (compressed to ~1 sec real-time)
- [ ] Reads `iot-devices.json` to determine which ULDs have integrated trackers; passive ULDs (no `iotDeviceId` in inventory) get **no measurement stream** — their telemetry is inferred by M5 from polygon ambient + last-known state
- [ ] Each emission produces an `:IotDevice` → `:Sensor[]` → `:Measurement[]` graph (TEMPERATURE, HUMIDITY, GPS, SHOCK)
- [ ] Deterministic given same scenarioParams (seeded RNG, no `Math.random()` directly)
- [ ] Hooks into demo clock store so demo speed (1×/2×/5×/10×) accelerates emission rate

**Test criteria**

- [ ] Unit: same scenarioParams → same measurement sequence
- [ ] Unit: changing demo speed proportionally changes emission interval
- [ ] Unit: GPS path follows the scenario's pre-defined waypoints

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M9 — Build-up flow logic

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| Status          | 🔘 Not started                                     |
| Owner           | —                                                  |
| Phase           | 2                                                  |
| Parallel-safe   | Yes                                                |
| Blocked by      | Phase 1, M4 (budget pre-flight calls into physics) |
| Blocks          | M13, M19                                           |
| Estimated hours | 2                                                  |

**Files**

- `lib/build-up/dg-checker.ts`
- `lib/build-up/shc-compat.ts`
- `lib/build-up/budget-preflight.ts`
- `lib/build-up/sign-off.ts`
- `lib/build-up/__tests__/*.test.ts`

**Success criteria**

- [ ] `dgChecker.validate(pieces, departure, arrival, flight): Promise<DgValidationResult>` calls `POST /api/dg/check` to **validate** any pre-issued `:DgDeclaration` for each piece. Pieces without a DGD return `{ piece, status: 'non-dg' }`; pieces with a valid DGD return `{ piece, status: 'valid', declaration }`; pieces with a DGD that's incompatible with the flight (e.g. CAO-only on a passenger aircraft) return `{ piece, status: 'rejected', declaration, reason }`. Build-up canvas blocks sign-off if any piece is `rejected`.
- [ ] `shcCompat.compatible(pieces): { ok: boolean; conflicts: ConflictReason[] }` — pure function over `:TemperatureInstructions`
- [ ] `budgetPreflight.forecast(uld, pieces, projectedAmbient): { budgetH, breachAt, warning: 'green'|'yellow'|'red' }` calls into M4 physics
- [ ] `signOff(uld, contents, sealNumber, station): { loading: Loading; event: LogisticsEvent }` emits canonical IATA shapes; does NOT persist (caller hands off to M10 audit DB)

**Test criteria**

- [ ] Unit: COL + PER pieces (both 2-8°C, no DGD) → `shcCompat.compatible` ok, `dgChecker.validate` returns all `non-dg`
- [ ] Unit: COL + CRT pieces (2-8°C vs 15-25°C) → SHC conflict
- [ ] Unit: piece with pre-existing DGD that's CAO-only, checked against passenger flight → `dgChecker.validate` returns `rejected`, sign-off blocked
- [ ] Unit: piece with pre-existing DGD compatible with flight → `dgChecker.validate` returns `valid`, sign-off allowed
- [ ] Unit: signOff emits `:Loading` with correct `loadedPieces`, `loadedUnits`, `actionStartTime`/`actionEndTime`, `performedAt`

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M10 — Audit DB (Dexie)

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 2              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 1        |
| Blocks          | M16, M17, M19  |
| Estimated hours | 1.5            |

**Files**

- `lib/persistence/audit-db.ts`
- `lib/persistence/local-prefs.ts`
- `lib/audit/excursion-logger.ts`
- `lib/audit/resolution-logger.ts`
- `lib/audit/root-cause-inferrer.ts`
- `lib/audit/deviation-report-builder.ts`
- `lib/audit/__tests__/*.test.ts`

**Success criteria**

- [ ] Dexie schema with three tables: `events` (LogisticsEvent), `actions` (LogisticsAction), `loadings` (Loading)
- [ ] All persisted records use canonical IATA shapes from M1 (no app-specific schema drift)
- [ ] `excursionLogger.detect(uldContext, threshold)` emits `:LogisticsEvent` with one of `WARNING_BUDGET_LOW`, `BREACH_PREDICTED`, `BREACH_ACTUAL` `eventCode`s
- [ ] `resolutionLogger.record(rankedAction, executor, executionTimeSec)` writes a `:LogisticsAction` linked to the triggering excursion via `servedActivity`
- [ ] `rootCauseInferrer.infer(event, context): string` returns short root-cause label
- [ ] `deviationReportBuilder.buildMarkdown(uldId): string` produces a well-formed Markdown deviation report
- [ ] `localPrefs.ts` wraps `localStorage` with typed get/set/clear

**Test criteria**

- [ ] Unit: detect → write → read round trip preserves record identity and canonical shape
- [ ] Unit: data persists across simulated reload (open new Dexie instance, read back)
- [ ] Unit: deviation report includes header, deviation summary, root cause, actions, recommendations sections

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

---

## Phase 3 — UI screens

All M11–M19 are parallel-safe within Phase 3 — each owns a route or component cluster. Shared shadcn primitives are read-only; no agent should modify `components/ui/*` after M0. Cross-cutting visual elements (`thermal-budget-bar`, `shc-badge`) live in `components/` and are owned by the first milestone that needs them; subsequent milestones import.

**`/shadcn` skill — MANDATORY before writing any FE layout.** Every agent working a Phase 3 milestone MUST invoke `/shadcn` before authoring component code. The skill surfaces current component docs, registry context, install commands, and composition examples. Skipping it leads to API drift, wrong prop shapes, and missed primitives. Also applies to M20 polish edits and any UI components introduced from Phase 2 work. See PLAN.md → **Design System** for the full design contract that must be honoured.

Components ownership map (first writer = owner):

| Component                                                                                                  | Owner milestone |
| ---------------------------------------------------------------------------------------------------------- | --------------- |
| `flight-card.tsx`                                                                                          | M11             |
| `awb-manifest-panel.tsx`, `uld-inventory-panel.tsx`, `built-uld-strip.tsx`                                 | M12             |
| `build-up-canvas.tsx`, `dg-check-row.tsx`, `shc-compat-row.tsx`, `budget-preflight-row.tsx`                | M13             |
| `airport-map.tsx`, `flight-overview-map.tsx`, `thermal-budget-bar.tsx`, `shc-badge.tsx`, `action-card.tsx` | M14             |
| `uld-tracker-table.tsx`, `weather-source-badge.tsx`, `push-time-card.tsx`                                  | M15             |
| `excursion-log-row.tsx`, `resolution-log-row.tsx`, `benefit-scatter-chart.tsx`                             | M16             |
| `audit-timeline.tsx`, `deviation-report-export.tsx`                                                        | M17             |

### M11 — Flight list page (`/`)

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 3              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 2        |
| Blocks          | M22            |
| Estimated hours | 1              |

**Files**

- `app/page.tsx`
- `components/flight-card.tsx`
- `lib/stores/flights-store.ts`

**Success criteria**

- [ ] Lists today's outbound flights at DXB from `GET /api/flights`
- [ ] One card per flight: flight no, ETD, destination, AWB count, ULDs built / total, urgency badge if any built ULD at-risk
- [ ] LIVE/MOCK weather badge in header, sourced from `GET /api/weather?airport=DXB`
- [ ] Click card → `router.push('/flight/[flightNo]')`
- [ ] Loading and empty states designed (skeleton + "no outbound flights today")

**Test criteria**

- [ ] Manual: open `/`, see ≥3 flight cards, weather badge present
- [ ] Manual: click a card, navigates to flight workspace
- [ ] Manual: simulate offline → ⚪ MOCK badge appears within 3s

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M12 — Flight workspace (`/flight/[flightNo]`)

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 3              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 2        |
| Blocks          | M22            |
| Estimated hours | 2.5            |

**Files**

- `app/flight/[flightNo]/page.tsx`
- `components/awb-manifest-panel.tsx`
- `components/uld-inventory-panel.tsx`
- `components/built-uld-strip.tsx`
- `lib/stores/uld-store.ts`
- `lib/stores/inventory-store.ts`

**Success criteria**

- [ ] Three coupled panels: AWB manifest (left), ULD inventory (right), built-ULD tracking strip (bottom)
- [ ] AWB manifest fetched from `GET /api/flights/[no]/shipments`, shows AWB no, SHC badge, weight, piece count
- [ ] ULD inventory fetched from `GET /api/uld-inventory`, shows uldSerialNumber, type, owner, serviceability
- [ ] `+ Build new ULD` button → `router.push('/flight/[no]/build/[uldId]')`
- [ ] Built-ULD strip rows show ULD ID, SHC, AWB count, current 5-stage state (from M5), thermal budget bar (from M14 component)
- [ ] Inventory mutations (a ULD becomes "in-build-up") persist in `sessionStorage` via `inventory-store`

**Test criteria**

- [ ] Manual: open `/flight/EK0083`, see manifest + inventory + (initially empty) tracking strip
- [ ] Manual: clicking a ULD in inventory routes to build-up canvas with that ULD's ID
- [ ] Manual: after build-up sign-off, return to workspace, ULD appears in tracking strip with correct SHC
- [ ] Manual: reload page mid-flow, in-progress build-up state recovered from sessionStorage

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M13 — Build-up canvas (`/flight/[flightNo]/build/[uldId]`)

| Field           | Value             |
| --------------- | ----------------- |
| Status          | 🔘 Not started    |
| Owner           | —                 |
| Phase           | 3                 |
| Parallel-safe   | Yes               |
| Blocked by      | Phase 2 (esp. M9) |
| Blocks          | M22               |
| Estimated hours | 2.5               |

**Files**

- `app/flight/[flightNo]/build/[uldId]/page.tsx`
- `components/build-up-canvas.tsx`
- `components/dg-check-row.tsx`
- `components/shc-compat-row.tsx`
- `components/budget-preflight-row.tsx`

**Success criteria**

- [ ] Drag-drop AWB cards from manifest into ULD contents area (use `react-dnd` or HTML5 DnD)
- [ ] Each drop triggers M9 `dgChecker.check` → DG row updates with pass/fail + reason
- [ ] On every contents change, M9 `shcCompat.compatible` runs → row updates
- [ ] On every contents change, M9 `budgetPreflight.forecast` runs against projected ambient → budget row updates with green/yellow/red
- [ ] Failed DG check rejects the drop with inline reason (rolls back the visual)
- [ ] Seal number input + `Sign off & seal` button — disabled while any validation row is red
- [ ] Sign-off calls M9 `signOff` → emits Loading + LogisticsEvent → writes via M10 audit DB → routes back to `/flight/[no]`

**Test criteria**

- [ ] Manual: drag two compatible AWBs, see DG ✅, SHC compat ✅, budget green; sign-off succeeds
- [ ] Manual: drag incompatible (COL + CRT), see SHC compat ❌ with reason, sign-off blocked
- [ ] Manual: simulate DG failure (use a piece with hazardous class in fixture), see drop rejected
- [ ] Manual: sign-off persists Loading + LogisticsEvent (verify via DevTools → Application → IndexedDB)

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M14 — ULD detail (`/uld/[uldId]`)

| Field           | Value                         |
| --------------- | ----------------------------- |
| Status          | 🔘 Not started                |
| Owner           | —                             |
| Phase           | 3                             |
| Parallel-safe   | Yes                           |
| Blocked by      | Phase 2 (esp. M4, M5, M6, M8) |
| Blocks          | M22                           |
| Estimated hours | 2.5                           |

**Files**

- `app/uld/[uldId]/page.tsx`
- `components/airport-map.tsx` (Leaflet, dynamic-imported with `ssr: false`)
- `components/flight-overview-map.tsx` (Leaflet, great-circle line origin → arrival)
- `components/thermal-budget-bar.tsx`
- `components/shc-badge.tsx`
- `components/action-card.tsx`

**Success criteria**

- [ ] Leaflet map renders with **CartoDB Dark Matter** tiles in dark theme, **Carto Voyager** tiles in light theme (per PLAN.md → **Map / Geo Visualisation**)
- [ ] No API key, no auth — pages load with map tiles on a fresh browser session, no env vars set
- [ ] Tile attribution visible bottom-right (`© OpenStreetMap contributors © CARTO`) and is not hidden by CSS
- [ ] Airport map view: DXB centered, geojson sub-zones overlaid as filled polygons, ULD pin at current GPS from latest `:Measurement` (or zone centre if passive ULD)
- [ ] Flight overview map view (when state is `in-flight` or `arrived-tarmac`): origin + arrival markers from `airports.json` + great-circle polyline + interpolated ULD position pin
- [ ] Map auto-switches between airport view (warehouse/tarmac states) and flight overview (in-flight/arrived states) based on M5 state
- [ ] Recharts time-series of internal °C, ambient °C, predicted budget curve, breach-line marker
- [ ] State inference panel shows current 5-stage state + sub-state + confidence (from M5)
- [ ] Pending action card if any (from M6); EXECUTE/REQUEST/ESCALATE buttons emit M10 resolution log entry
- [ ] Tabs: `History` (linked excursions/resolutions), `Timeline` (deferred to M17 component, link only), `Raw measurements` (JSON viewer of `:Measurement[]` from M8)
- [ ] Map component dynamically imported with `next/dynamic` and `ssr: false`; falls back to a `bg-muted animate-pulse` skeleton during load

**Test criteria**

- [ ] Manual: open `/uld/[anyBuiltUld]` in dark mode, see Carto Dark Matter tiles, ULD pin visible
- [ ] Manual: toggle to light mode, tiles switch to Carto Voyager
- [ ] Manual: open with a passive (no-tracker) ULD, pin renders at zone centre with `🔵 Inferred` badge
- [ ] Manual: trigger demo scenario reaching `in-flight`, map flips to flight overview with origin → arrival great-circle line + animated pin position
- [ ] Manual: trigger demo scenario reaching breach-prediction, see action card with top-3 ranked actions
- [ ] Manual: click EXECUTE on an action, see resolution recorded (visible in `/supervisor/resolutions` after M16)
- [ ] Manual: chart x-axis aligns with demo clock; bars/lines re-render on tick
- [ ] Manual: kill network, reload — map tiles fail gracefully (grey squares), rest of UI still renders

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |
| 2026-04-25 | Locked free-tile providers (CartoDB Dark Matter / Voyager / OSM fallback, no API key). Added flight-overview map for in-flight states. Added explicit attribution + SSR-disabled dynamic-import success criteria. New file `components/flight-overview-map.tsx`. | Lead |

### M15 — Supervisor dashboard (`/supervisor`)

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 3              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 2        |
| Blocks          | M22            |
| Estimated hours | 2              |

**Files**

- `app/supervisor/page.tsx`
- `components/uld-tracker-table.tsx`
- `components/weather-source-badge.tsx`
- `components/push-time-card.tsx`

**Success criteria**

- [ ] Sortable table of all built ULDs across today's outbound flights at DXB
- [ ] Columns: ULD ID, type, SHC badge, stage (5-stage), internal °C, ambient °C, budget remaining (color-coded), outbound flight, status
- [ ] Header: LIVE/MOCK weather badge, station (DXB), resource counters (free cool dollies, free cool-room slots)
- [ ] Row click → `/uld/[id]` drill-down
- [ ] Aggregated hold/release card list driven by M7 push-time scheduler

**Test criteria**

- [ ] Manual: open `/supervisor` after building 2 ULDs, table shows both rows
- [ ] Manual: sort by budget asc/desc works
- [ ] Manual: row colors update live as scenario runs
- [ ] Manual: hold-list card surfaces when an AVI/PER ULD enters scheduler hold window

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M16 — Excursion + Resolution logs

| Field           | Value              |
| --------------- | ------------------ |
| Status          | 🔘 Not started     |
| Owner           | —                  |
| Phase           | 3                  |
| Parallel-safe   | Yes                |
| Blocked by      | Phase 2 (esp. M10) |
| Blocks          | M22                |
| Estimated hours | 1.5                |

**Files**

- `app/supervisor/excursions/page.tsx`
- `app/supervisor/resolutions/page.tsx`
- `components/excursion-log-row.tsx`
- `components/resolution-log-row.tsx`
- `components/benefit-scatter-chart.tsx`

**Success criteria**

- [ ] Excursion log reads `LogisticsEvent[]` from audit DB filtered to severity event codes
- [ ] Resolution log reads `LogisticsAction[]` from audit DB filtered to action library references
- [ ] Filters: ULD, date range, SHC, severity (excursion); action category, outcome (resolution)
- [ ] Aggregates on resolution page: outcome pie chart, action-frequency bar chart, claimed-vs-actual benefit scatter
- [ ] Each row links: excursion → linked resolution; resolution → linked excursion

**Test criteria**

- [ ] Manual: run scenario, breach predicted → entry appears in excursion log with severity badge
- [ ] Manual: execute action → entry appears in resolution log with claimed/actual benefit
- [ ] Manual: filters narrow result set correctly
- [ ] Manual: scatter chart populated after multiple actions

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M17 — Audit timeline + deviation report

| Field           | Value              |
| --------------- | ------------------ |
| Status          | 🔘 Not started     |
| Owner           | —                  |
| Phase           | 3                  |
| Parallel-safe   | Yes                |
| Blocked by      | Phase 2 (esp. M10) |
| Blocks          | M22                |
| Estimated hours | 2                  |

**Files**

- `app/supervisor/audit/[uldId]/page.tsx`
- `components/audit-timeline.tsx`
- `components/deviation-report-export.tsx`

**Success criteria**

- [ ] Combined chronological timeline merging `LogisticsEvent[]`, `LogisticsAction[]`, `Loading[]` for one ULD
- [ ] Each timeline node shows timestamp (demo clock + wall clock), event/action type, location, outcome
- [ ] Auto-drafted Markdown deviation report below timeline (from M10 builder), rendered in preview
- [ ] `Export deviation report` button downloads the Markdown as `.md`
- [ ] `Export full audit bundle` button downloads JSON-LD with all events/actions/loadings for the ULD

**Test criteria**

- [ ] Manual: open `/supervisor/audit/[uld]`, see merged timeline ordered by `eventDate` / `actionStartTime`
- [ ] Manual: click `Export deviation report`, file downloads with valid Markdown
- [ ] Manual: click `Export full audit bundle`, JSON-LD downloads and parses

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M18 — Admin config (`/admin/config`)

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 3              |
| Parallel-safe   | Yes            |
| Blocked by      | Phase 2        |
| Blocks          | M22            |
| Estimated hours | 1              |

**Files**

- `app/admin/config/page.tsx`

**Success criteria**

- [ ] Display loaded SHC config in a table
- [ ] Toggle: force-mock weather (writes a flag to `localPrefs`, weather adapter respects it)
- [ ] `Reload SHC config` button re-fetches `/public/config/shc.json` with cache-bust query string
- [ ] Display loaded station config (DXB)

**Test criteria**

- [ ] Manual: edit `shc.json` in dev tools, click reload, scheduler picks up new threshold on next tick
- [ ] Manual: toggle force-mock, reload `/`, weather badge flips to ⚪ MOCK
- [ ] Manual: scheduler unit verifiable via `/supervisor` push-time card change

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M19 — Scenario runner + Demo control panel

| Field           | Value                              |
| --------------- | ---------------------------------- |
| Status          | 🔘 Not started                     |
| Owner           | —                                  |
| Phase           | 3                                  |
| Parallel-safe   | Yes                                |
| Blocked by      | Phase 2 (uses M5, M6, M8, M9, M10) |
| Blocks          | M20, M22                           |
| Estimated hours | 3                                  |

**Files**

- `app/dev/control/page.tsx`
- `app/dev/inject/page.tsx` (embedded inside control panel)
- `lib/simulator/scenario-runner.ts` (imports `scenario-schema.ts` from M2 for runtime validation)
- `lib/simulator/event-handlers/scenario-start.ts`
- `lib/simulator/event-handlers/flight-delay.ts`
- `lib/simulator/event-handlers/weather-override.ts`
- `lib/simulator/event-handlers/weather-ramp.ts`
- `lib/simulator/event-handlers/time-of-day-change.ts`
- `lib/simulator/event-handlers/auto-drag.ts`
- `lib/simulator/event-handlers/dg-check-complete.ts`
- `lib/simulator/event-handlers/build-up-signoff.ts`
- `lib/simulator/event-handlers/uld-state-force.ts`
- `lib/simulator/event-handlers/physics-recompute.ts`
- `lib/simulator/event-handlers/notification.ts`
- `lib/simulator/event-handlers/alert.ts`
- `lib/simulator/event-handlers/ui-focus.ts`
- `lib/simulator/event-handlers/wait-for-user-action.ts`
- `lib/simulator/event-handlers/uld-action-complete.ts`
- `lib/simulator/event-handlers/scenario-end.ts`
- `lib/stores/demo-clock-store.ts`
- `lib/stores/resources-store.ts`
- `lib/notifications/web-notify.ts`

**Success criteria**

- [ ] Scenario runner loads `scenarios.json`, exposes Play/Pause/Skip/Reset
- [ ] Tick counter (1 tick = 1 sec real time, scaled by demo speed)
- [ ] Event queue dispatches to handler files based on `event.type`
- [ ] Time-of-day, weather mode, demo speed, sound toggles wired to stores
- [ ] Manual injection panel embedded — fires same event handlers
- [ ] Web Notifications request permission once, fire on `notification` events
- [ ] `wait_for_user_action` pauses clock until expected interaction or fallback timer
- [ ] All routes hidden in production unless `NEXT_PUBLIC_DEMO_MODE === 'true'`

**Test criteria**

- [ ] Manual: PLAY DXB Warehouse Demo → all 4 scenarios advance through events on schedule
- [ ] Manual: pause / resume / reset / skip work
- [ ] Manual: switch scenarios mid-play → clean state transition
- [ ] Manual: `wait_for_user_action` → execute the expected action → scenario resumes
- [ ] Manual: 2× speed halves duration, logic still correct
- [ ] Manual: replay deterministic — same inputs, same outputs

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

---

## Phase 4 — Polish & demo

### M20 — Polish: notifications, theming, charts

| Field           | Value                             |
| --------------- | --------------------------------- |
| Status          | 🔘 Not started                    |
| Owner           | —                                 |
| Phase           | 4                                 |
| Parallel-safe   | No (touches multiple UI surfaces) |
| Blocked by      | Phase 3                           |
| Blocks          | M21                               |
| Estimated hours | 1.5                               |

**Files**

- Various — `components/*` and `app/*` polish edits

**Success criteria**

- [ ] Web Notifications wired across app (alerts deep-link to `/uld/[id]`)
- [ ] Time-of-day theme (light/dark) flips based on demo clock store
- [ ] Benefit-scatter chart populated with sample resolutions for demo
- [ ] Loading skeletons on all data-fetching screens
- [ ] Toast notifications for in-app alerts (when browser notifications denied)

**Test criteria**

- [ ] Manual: every screen renders in light + dark
- [ ] Manual: notifications fire from scenario events; clicking deep-links correctly
- [ ] Manual: loading states visible on slow network throttle

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M21 — Pitch deck

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 4              |
| Parallel-safe   | No             |
| Blocked by      | M20            |
| Blocks          | M22            |
| Estimated hours | 1              |

**Files**

- `app/pitch/page.tsx` (or static HTML at `/public/pitch.html`)
- `public/pitch/*` (assets)

**Success criteria**

- [ ] 5 slides: problem / gap / solution / live demo / ONE Record day-one
- [ ] Each slide < 10 words core message
- [ ] Routes accessible from `/dev/control` `pitch_slide` ui_focus event
- [ ] Final deploy to Vercel succeeds

**Test criteria**

- [ ] Manual: navigate all 5 slides, content renders, no broken links
- [ ] Manual: scenario `pitch_slide` ui_focus event auto-navigates to deck

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

### M22 — End-to-end rehearsal & bug fixes

| Field           | Value          |
| --------------- | -------------- |
| Status          | 🔘 Not started |
| Owner           | —              |
| Phase           | 4              |
| Parallel-safe   | No             |
| Blocked by      | M21            |
| Blocks          | —              |
| Estimated hours | 2              |

**Files**

- Bug fixes across all milestones as discovered

**Success criteria**

- [ ] All 4 scenarios run end-to-end with no console errors
- [ ] DXB Warehouse Demo fits in 3 min with 5-sec slack
- [ ] Live Vercel URL works on a fresh machine
- [ ] All 29 verification checks (PLAN.md → **Verification (end-to-end)**) pass

**Test criteria**

- [ ] Run PLAN.md → **Verification (end-to-end)** checklist twice; both runs pass
- [ ] Demo recording captured as fallback artifact

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope | Lead |

---

## Cross-phase

### M23 — Real DG AutoCheck integration

Spec source: [`dg-autocheck-api/integration.md`](./dg-autocheck-api/integration.md) (distilled) and `dg-autocheck-api/DG_AutoCheck_Connect_API_Integration_Instructions.md` (full v7.2). DG AutoCheck Connect API v1 is an **async workflow**, not stateless validation: create check → upload DGD (XSDG or PDF) → request single-use URL → user completes verification + doc/packaging check in DG AutoCheck UI → webhook fires → CMS pulls XSDG export + PDF report.

| Field           | Value                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Status          | 🔘 Not started                                                                                                                     |
| Owner           | —                                                                                                                                  |
| Phase           | × (cross-phase)                                                                                                                    |
| Parallel-safe   | Yes — independent of Phase 2/3 work; gated only on DG AutoCheck sandbox credentials. Stub stays default.                           |
| Blocked by      | M3 (stub adapter exists), M13 (build-up canvas exists for the modal/iframe)                                                        |
| Blocks          | —                                                                                                                                  |
| Estimated hours | 6 (OAuth client + create/upload/request-url orchestration + webhook listener + signature verification + UI iframe + state polling) |

**Files**

- `lib/adapters/dg-check.ts` (extend stub: add `mode: 'stub' | 'autocheck'` based on env `DG_AUTOCHECK_ENABLED`)
- `lib/adapters/dg-autocheck/client.ts` (OAuth token cache, base fetch with `Authorization: Bearer …`)
- `lib/adapters/dg-autocheck/acceptance-check.ts` (Create / Request URL / Scan PDF / Import XSDG / Read / OPTIONS endpoints)
- `lib/adapters/dg-autocheck/types.ts` (TS types for `AcceptanceCheck`, `AcceptanceCheckStatus`, `WebhookEvent`)
- `lib/adapters/dg-autocheck/webhook-verify.ts` (SHA-256 signature verification using verification token + raw body)
- `app/api/dg/check/route.ts` (forward POST → autocheck.create → optional scan-dgd/import-xsdg → request-url → returns `{ status: 'pending', requestedUrl, acceptanceCheckId }`)
- `app/api/dg/check/[id]/route.ts` (GET — read latest state for polling fallback)
- `app/api/webhooks/dg-autocheck/route.ts` (POST — webhook listener; **disables Next.js body parsing** to preserve raw body for signature check; updates in-memory state map keyed by `acceptanceCheckId`; idempotent on `(eventLogId, attempt)`)
- `lib/stores/dg-autocheck-store.ts` (zustand: maps `pieceIri` → `acceptanceCheckId` → `lastKnownStatus`; subscribed by build-up canvas)
- `components/dg-autocheck-modal.tsx` (iframe wrapper for `requestedUrl`, listens for status flip via store, surfaces 10-min URL expiry timer)
- `.env.local.example` (new vars: `DG_AUTOCHECK_ENABLED`, `DG_AUTOCHECK_BASE_URL`, `DG_AUTOCHECK_CLIENT_ID`, `DG_AUTOCHECK_CLIENT_SECRET`, `DG_AUTOCHECK_VERIFICATION_TOKEN`, `DG_AUTOCHECK_OFFICE_IDENTIFIER`)

**Endpoint mapping (canonical → DG AutoCheck v1)**

| Our canonical action                                                  | DG AutoCheck call                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/dg/check` (begin validation for a piece w/ pre-issued DGD) | `POST /api/v1/acceptance-checks` (create) → `PUT /api/v1/acceptance-checks/:id/import/xsdg` if we have XSDG, else `PUT /api/v1/acceptance-checks/:id/scan-dgd/pdf` if PDF, else Option 1 (no DGD passed) → `POST /api/v1/acceptance-checks/:id/request-url` |
| `GET /api/dg/check/:id` (poll status)                                 | `GET /api/v1/acceptance-checks/:acceptanceCheckId`                                                                                                                                                                                                          |
| Webhook ingress                                                       | DG AutoCheck → `POST /api/webhooks/dg-autocheck` (events: `acceptance-check-passed`, `acceptance-check-failed`, `acceptance-check-completed`)                                                                                                               |
| Pull verified DGD on success                                          | `GET /api/v1/acceptance-checks/:id/export/xsdg` (XSDG XML) → adapter parses → returns canonical `:DgDeclaration`                                                                                                                                            |
| Pull report PDF                                                       | `GET /api/v1/acceptance-checks/:id/report/pdf` → store as resource on the linked `:Piece`                                                                                                                                                                   |

**Status mapping (DG AutoCheck → our `DgValidationResult.status`)**

- `awaiting-file` / `queued` / `scanning` / `verification-*` / `awaiting-document-check` / `documentation-check-*` / `awaiting-packaging-check` / `packaging-check-*` → `pending`
- `completed` + `signOff.result === 'passed'` → `valid`
- `completed` + `signOff.result === 'failed'` → `rejected` (with reason from completion payload)
- `processing-error` / `import-failure` → `rejected` (system error reason)

**Success criteria**

- [ ] OAuth 2.0 client-credentials flow implemented; `access_token` cached until ~30s before `expires_in`
- [ ] `POST /api/dg/check` (real mode) creates an Acceptance Check, uploads DGD if available (XSDG or PDF), requests single-use URL, returns `{ status: 'pending', requestedUrl, acceptanceCheckId }` to client
- [ ] Build-up canvas opens `requestedUrl` in `dg-autocheck-modal` iframe with 10-min expiry countdown
- [ ] `app/api/webhooks/dg-autocheck/route.ts`: receives webhook, verifies SHA-256 signature using `DG_AUTOCHECK_VERIFICATION_TOKEN` + **raw, untouched** request body, updates `dg-autocheck-store` state map; idempotent on `(eventLogId, attempt)`; ACKs in <1s
- [ ] Build-up canvas DG row reflects status changes from store: `pending` → spinner; `valid` → ✅; `rejected` → ❌ with reason
- [ ] On `acceptance-check-passed`: backend pulls XSDG export, adapter normalises to `:DgDeclaration`, attaches to the canonical `:Piece`
- [ ] Auth credentials read from env vars only (never hardcoded)
- [ ] Treat `403` on lifecycle endpoints as terminal; treat `409` as retryable later
- [ ] **Stub mode preserved**: when `DG_AUTOCHECK_ENABLED !== 'true'`, `/api/dg/check` continues using M3 fixture-based stub (returns synchronous `valid`/`rejected`/`non-dg` from `dg-declarations.json`). Demo runs offline.
- [ ] Webhook listener returns 200 even if signature mismatch (logs the rejection); never leaks 401/403 (mirrors DG AutoCheck spec — webhook callers don't get useful status feedback)

**Test criteria**

- [ ] Stub mode (`DG_AUTOCHECK_ENABLED=false`): build-up canvas DG check still passes/fails correctly per fixture data (M13 manual test repeated, no regression)
- [ ] Real mode (`DG_AUTOCHECK_ENABLED=true`): drop a DG-declared piece, modal opens DG AutoCheck UI, complete verification, webhook fires, DG row flips to ✅ within 5s
- [ ] Webhook signature verification: mock a request with bad signature → store NOT updated; mock with good signature → store updated
- [ ] OAuth token cache: two consecutive `/api/dg/check` calls only hit `/oauth2/token` once
- [ ] Build-up canvas blocks sign-off while any DG check is `pending`
- [ ] Polling fallback: kill webhook for 30s, `GET /api/dg/check/:id` continues to refresh status; build-up canvas reconverges
- [ ] 10-min single-use URL expiry shows visible countdown; on expiry, "Request new URL" button calls `POST /…/request-url` again

**Hackathon execution note**

Real DG AutoCheck integration requires a sandbox subscription (`client_id` / `client_secret` from DG AutoCheck Web Services portal) **and** a publicly-reachable webhook URL. Vercel preview deploy provides the public URL automatically. Local dev needs ngrok or `vercel dev` with a tunnel.

For the **scripted 3-min demo**, default to **stub mode** — eliminates dependency on DG AutoCheck infrastructure for the headline run. Real-mode toggle is a separate "B-side" demo button if judges want to see the real workflow.

**Revisions**
| Date | Change | By |
|---|---|---|
| 2026-04-25 | Initial scope; awaits DG API spec from hackathon organisers | Lead |
| 2026-04-25 | DG API spec received: **DG AutoCheck Connect API v1** (`dg-autocheck-api/`). Async workflow (not stateless): create → upload → user-completes-in-vendor-UI → webhook. M23 expanded into a 6-hour milestone covering OAuth client, lifecycle endpoints, webhook listener with SHA-256 verification, modal iframe, state polling fallback. Stub mode preserved as demo default. New env var contract documented. | Lead |
