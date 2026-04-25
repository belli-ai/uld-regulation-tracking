# Plan — Cool-Chain Copilot (Jettainer ULD Hackathon)

> **Reframed:** flight-centric warehousing app at a single station (DXB) with cool-chain intelligence baked in. Desktop-first. Next.js FE + small API routes (no DB). Data models aligned to **IATA ONE Record v3.2** ontology so external API integration (DG check, One Connect Waybill stream, live ULD location + temperature telemetry) is a localised swap.

> **Implementation tracking** lives in [`MILESTONES.md`](./MILESTONES.md) — milestone status board, per-milestone success/test criteria, revisions, and multi-agent workflow rules.
>
> **Mock data plan** lives in [`MOCK_DATA.md`](./MOCK_DATA.md) — concrete fixtures (flights, AWBs, ULDs, trackers, geofence, weather), the scenario impact matrix that ties every fixture to its scenarios, and the DGD mapping placeholder.

## Context

**Challenge** (Jettainer ULD Hackathon): Ensure cool-passive pallets are always stored and handled within the correct temperature range. Build end-to-end solution for cool-passive shipment tracking that fuses ULD tracker information with additional IoT data to monitor ambient temperature along the supply chain in real time, ensuring continuous control and compliance of exposure times.

**Why this angle**: The highest-impact gap in current passive cold-chain ops is the warehouse → tarmac → in-flight → arrival chain where a built-up ULD has limited scan visibility and exposure-budget forecasts are not surfaced to the operator who decides what to do next. Trackers continuously report GPS + ambient, but no warehousing UI fuses telemetry → location-state inference → physics-driven budget forecast → station-aware mitigation, and no warehousing UI ties the *build-up* of ULDs to the cool-chain story that follows.

**The reframe**: We embed the cool-chain intelligence inside the **warehousing system the operator already opens at start of shift** — flights → shipments → ULDs → build-up → tracking → alerts. Operator never leaves the workspace.

User-driven additions (preserved):
1. **Per-station action recommender** — handler-actionable mitigations filtered by THIS station's capabilities (cool room? cool dolly? AC zones?).
2. **Push-time / max-wait scheduler for PER / AVI** — for IATA special-handling shipments post-build-up, recommend optimal release moment from cool warehouse to airside.
3. **Externalised SHC config** — temperature ranges and max-wait curves per IATA Special Handling Code, editable JSON, drives both Push-Time Scheduler and Action Recommender urgency. Internally mapped to `:TemperatureInstructions` per ONE Record ontology.

**Primary user**: **Cargo warehousing operator** (GHA build-up clerk + ramp coordinator role in one). Single workspace covers manifest, build-up, tracking, alerts. Supervisor view bolted on for aggregate / audit.

**Intended outcome**: Hackathon-deployable desktop-first warehousing PWA. **Frontend (Next.js client) + small Next.js API routes** that act as stateless adapters to external APIs (Open-Meteo weather, hackathon-provided DG check API). No DB. Persistence via `localStorage` / `sessionStorage` / `IndexedDB`. 3-minute scripted demo starting with build-up, ending on full audit timeline. Pitch slide:

> "Today's warehousing systems show you what's in the manifest. They do not warn you that the AVI ULD you just built will breach in 38 minutes if it sits on tarmac through TK0181's delay. We bake cool-chain physics directly into the build-up screen — same Jettainer telemetry, same SHC config, decided in the workspace where the operator already lives. Compatible with IATA ONE Record from day one."

## Scope (locked)

| Decision | Value |
|---|---|
| Outer shell | Warehousing app — primary surface |
| Stations | **Single station, DXB** for demo |
| Mobile-first | **No.** Desktop-first throughout |
| Backend | Next.js API routes (stateless adapters), **no DB** |
| Persistence | Client-only: `localStorage` / `sessionStorage` / IndexedDB |
| Shipment unit | **AWB-level** (one Waybill = one drag-drop unit) |
| State machine surface | **5-stage simplified** (warehouse → tarmac → in-flight → arrived-tarmac → arrived-destination); rich internal model behind it |
| Cuts | Transit sub-states (through-stage vs breakdown) — dropped |
| Data models | **IATA ONE Record v3.2 ontology** (`https://onerecord.iata.org/ns/cargo#`) |
| External APIs | Open-Meteo (weather) + DG AutoCheck; **One Connect / 1Neo-Connect** for Waybill subscriptions and ULD location + temperature telemetry |

## Stack Posture

**Frontend + small Next.js API routes, no DB.**

- Single Next.js 14 app — App Router, TypeScript, Tailwind, shadcn/ui
- Client owns state, physics, recommender, scheduler, scenario runner
- Next.js API routes are **stateless adapters** between external sources and canonical IATA ONE Record shapes
- Persistence: `localStorage` (prefs), `sessionStorage` (demo state, mock inventory mutations), `IndexedDB` via Dexie (audit logs)
- No DB, no WebSocket, no auth — single Vercel deploy
- Telemetry simulated in-browser via tick loop

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Cool-Chain Copilot — Flight-Centric Warehousing (DXB single-station)    │
│                                                                          │
│  ┌─ Browser (Next.js client, desktop-first) ────────────────────────┐   │
│  │                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │ Flight workspace │  │ Build-up canvas  │  │ Tracking strip │ │   │
│  │  │ (primary)        │  │ (drag-drop AWB)  │  │ + alerts       │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │
│  │  │ Supervisor dash  │  │ Audit logs       │  │ Demo control   │ │   │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌─ Compute subsystems (TS, run client-side) ───────────────────┐│   │
│  │  │ State Inference · Physics ODE · Action Recommender · Push-   ││   │
│  │  │ Time Scheduler · Tracker Simulator · Scenario Runner          ││   │
│  │  └────────────────────────────────────────────────────────────────┘│   │
│  │                                                                   │   │
│  │  Persistence: localStorage · sessionStorage · IndexedDB(Dexie)   │   │
│  └────────────────────────────┬──────────────────────────────────────┘   │
│                               │ fetch                                     │
│  ┌────────────────────────────▼──────────────────────────────────────┐   │
│  │  Next.js API routes (stateless, Node runtime, no DB)              │   │
│  │  GET  /api/flights              GET  /api/uld-inventory           │   │
│  │  GET  /api/flights/[no]/shipments                                 │   │
│  │  POST /api/dg/check                                                │   │
│  │  GET  /api/weather                                                 │   │
│  │                                                                    │   │
│  │  Each route = adapter: (external shape) → (canonical ONE Record)  │   │
│  └────────────────────────────┬──────────────────────────────────────┘   │
│                               │                                            │
│              ┌────────────────┼─────────────────────┐                     │
│              ▼                ▼                     ▼                     │
│       /public/data       Open-Meteo          DG AutoCheck + One Connect   │
│       (mock JSON         (live weather)      (real, spec TBD)             │
│        in IATA shape)                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Subsystem 1 — State Inference Engine

- **Purpose**: Infer ULD lifecycle state from tracker telemetry. Externally exposed as 5 stages; internally classifier still uses geofence + ambient-delta rules.
- **5 stages surfaced in UI**:
  1. `in-warehouse` — ULD is at origin warehouse (cool-room, ambient, build-up area all collapse to this bucket)
  2. `in-tarmac` — ULD is on origin airside (transit, loading, loaded-in-hold)
  3. `in-flight` — ULD is airborne
  4. `arrived-tarmac` — ULD is on destination airside (offloaded, awaiting last-mile)
  5. `arrived-destination` — ULD is at destination warehouse (or customs / last-mile)
- **Internal sub-states** (used by physics + action recommender, not surfaced as nav): `cool-room` vs `ambient` within warehouse; `loading` vs `staging` within tarmac. Drives recommender filters and physics ambient model.
- **Method**: airport polygon geofence using `@turf/turf` + ambient-delta heuristic vs reference warehouse temp + dwell pattern.
- **TS module**: `lib/inference/state-classifier.ts` — produces `:LogisticsEvent` with `eventCode` from a fixed enum (`STATE_WAREHOUSE_IN`, `STATE_TARMAC_IN`, `STATE_FLIGHT_IN`, `STATE_TARMAC_DEST_IN`, `STATE_DEST_WAREHOUSE_IN`).

### Subsystem 2 — Thermal Physics Engine (PCM Digital Twin)

Unchanged from original plan. Lumped-thermal-mass ODE, Euler integration, ~50 lines of TS.

```ts
function integrateBudget(uldSpec, T_internal_now, ambientCurve, dt = 60) {
  let T = T_internal_now;
  let elapsed = 0;
  for (const ambientPoint of ambientCurve) {
    const dTdt = (ambientPoint.T - T) * uldSpec.k - pcmAbsorption(T, uldSpec);
    T += dTdt * dt;
    elapsed += dt;
    if (T > uldSpec.maxAcceptableInternal) return { budgetSec: elapsed, breachAt: ambientPoint.timestamp };
  }
  return { budgetSec: Infinity, breachAt: null };
}
```

Calibration per ULD product. Constants in `lib/physics/uld-specs.ts` and surfaced via `/api/uld-inventory` so adapter can map external ULD type code → PCM spec.

### Subsystem 3 — Action Recommender

Same structure as original. Action library trimmed: drop transit-specific T1-T7 (transit sub-states cut). Keep ~25 actions across 10 categories. Filter by station capability (DXB only), real-time mock resource availability, time-to-execute < time-to-breach.

Each ranked action serialised as `:LogisticsAction` per ONE Record ontology — `actionStartTime`, `actionEndTime`, `performedAt`, `servedActivity`, `contactPersons`. Execution log in audit DB stores these directly.

**TS module**: `lib/recommender/{action-library,ranker,filters}.ts`.

### Subsystem 4 — Push-Time / Max-Wait Scheduler (SHC-driven)

Unchanged. SHC config drives optimal release time + max airside wait + hold/release decision. Surfaces in flight workspace as a hold/release card per built ULD; supervisor dashboard shows aggregated hold list.

Internally, each SHC config entry is mapped to a `:TemperatureInstructions` instance (`minTemperature`, `maxTemperature`) plus a max-wait-vs-ambient curve (our extension; ONE Record has no equivalent concept).

## Routes & Navigation

Flight-centric. Primary nav is today's outbound flights at DXB.

**Operator routes** (desktop-first, single workspace):

| Route | Purpose |
|---|---|
| `/` | **Today's outbound flights** at DXB. Card per flight: flight no, ETD, dest, AWB count, ULDs built / total, urgency badge if any built ULD at-risk. |
| `/flight/[flightNo]` | **Flight workspace** — unified: AWB manifest panel · ULD inventory panel · built-ULD tracking strip · alerts inline. Heart of the app. |
| `/flight/[flightNo]/build/[uldId]` | **Build-up canvas** — drag AWBs from manifest into ULD slot, DG check fires per piece, SHC validation, sign-off. |
| `/uld/[uldId]` | **Per-ULD drill-down** — live map (Leaflet, single-airport zoom), time-series chart (Recharts), state inference, pending action card, raw tracker tab. |
| `/scan` | Mocked QR/barcode scan → resolves to ULD or AWB. |

**Supervisor routes**:

| Route | Purpose |
|---|---|
| `/supervisor` | Global aggregate — sortable table of all built ULDs across all today's flights, with state, budget, alert status. |
| `/supervisor/excursions` | Excursion log (warning / alert / excursion `:LogisticsEvent`s) |
| `/supervisor/resolutions` | Resolution log (`:LogisticsAction`s + outcomes) |
| `/supervisor/audit/[uldId]` | Per-ULD audit timeline + auto-drafted deviation report export |
| `/admin/config` | View/edit SHC + station config + force-mock weather toggle |

**Demo routes** (hidden via `NEXT_PUBLIC_DEMO_MODE`):

| Route | Purpose |
|---|---|
| `/dev/control` | Demo control panel — scenario library, play/pause/reset, time-of-day, weather mode, sound, manual injection panel |
| `/dev/inject` | Embedded inside `/dev/control` — manual one-off event triggers |

**API routes** (server-side, stateless, Node runtime):

| Route | Method | Adapts |
|---|---|---|
| `/api/flights` | GET | Mock flight data (or future carrier API). Returns today's outbound at DXB as `:TransportMovement[]`. |
| `/api/flights/[flightNo]/shipments` | GET | AWB manifest as `:Waybill[]` with `:Piece[]` + `:TemperatureInstructions` + linked `:DgDeclaration` if any. |
| `/api/uld-inventory` | GET | Available ULDs at DXB as `:ULD[]` (subclass of `:LoadingUnit`). Mutations stay client-side in `sessionStorage`. |
| `/api/dg/check` | POST | Forwards to hackathon-provided DG API. Adapts request → `{ pieces: :Piece[], departure: :Location, arrival: :Location }`. Adapts response → `:DgDeclaration`. |
| `/api/weather` | GET | Open-Meteo proxy with 3s timeout + mock fallback. Returns canonical ambient curve. |

Adapter pattern means future real-API swap = replace one route, no UI change.

## Data Models — IATA ONE Record v3.2 alignment

All canonical types live in `lib/ontology/one-record.ts` and mirror classes from `https://onerecord.iata.org/ns/cargo#`. Every external source is normalised TO these shapes inside the API route layer. Internal compute subsystems (physics, recommender, scheduler) speak only canonical types.

### Class mapping

| App concept | IATA class | Key properties used |
|---|---|---|
| Outbound flight | `:TransportMovement` ⊂ `:LogisticsActivity` | `arrivalLocation`, `departureLocation`, `movementTimes`, `operatingParties`, `loadingActions`, `modeCode` |
| Flight booking | `:Booking` ⊂ `:LogisticsService` | `bookingTimes`, `carrier`, `carrierProduct`, `transportLegs`, `issuedForWaybill`, `bookingShipmentDetails` |
| AWB / shipment | `:Waybill` ⊂ `:LogisticsObject` | `arrivalLocation`, `departureLocation`, `accountingNotes`, `declaredValueForCarriage`, `billingDetails` |
| Shipment grouping | `:Shipment` | groups Waybills + Pieces |
| Cargo piece | `:Piece` ⊂ `:PhysicalLogisticsObject` | `containedItems`, `dimensions`, `grossWeight`, `inPiece`, `loadType`, `ofShipment`, `customsInformation`, `fulfillsUldTypeCode` |
| ULD inventory item | `:ULD` ⊂ `:LoadingUnit` | `uldSerialNumber`, `uldTypeCode`, `serviceabilityCode`, `damageFlag`, `sealNumber`, `numberOfDoors`, `loadingIndicator`, `ownerCode`, `ataDesignator` |
| Build-up action | `:Loading` ⊂ `:LogisticsAction` | `loadedPieces`, `loadedUnits`, `loadingType`, `onTransportMeans`, `loadingPositionIdentifier`, `actionStartTime`, `actionEndTime`, `performedAt` |
| Warehouse storage | `:Storing` ⊂ `:LogisticsAction` | `:Storage` location, `storingType` |
| Tracker (IoT box) | `:IotDevice` | container for `:Sensor[]` |
| Sensor | `:Sensor` ⊂ `:PhysicalLogisticsObject` | `measurements`, `sensorType`, `serialNumber`, `partOfIotDevice` |
| Telemetry reading | `:Measurement` | `measurementValue`, `measurementTimestamp`, `recordedGeolocation` |
| State transition / event | `:LogisticsEvent` | `eventCode`, `eventFor`, `eventLocation`, `eventDate`, `eventName`, `recordingActor`, `recordingOrganization` |
| Excursion event | `:LogisticsEvent` w/ custom eventCode | `BREACH_PREDICTED`, `BREACH_ACTUAL`, `WARNING_BUDGET_LOW` |
| Resolution / executed action | `:LogisticsAction` | linked to triggering event via `servedActivity` |
| DG check | `:DgDeclaration` ⊂ `:LogisticsObject` | `issuedForPiece`, `declarationDate`, `declarationPlace`, `departureLocation`, `arrivalLocation`, `complianceDeclarationText`, `aircraftLimitationInformation`, `exclusiveUseIndicator`, `shippingRefNo` |
| Temperature spec (SHC) | `:TemperatureInstructions` | `minTemperature`, `maxTemperature` — linked from `:Piece` / `:Waybill` |
| Location | `:Location` | `:Address`, `:Geolocation` |
| Party (shipper/carrier/handler) | `:Party` w/ `:Carrier` / `:Organization` / `:Person` | `accountNumbers`, `contactDetails` |

### TypeScript shape (sketch)

```ts
// lib/ontology/one-record.ts
export type IRI = string;
export interface LogisticsObject { '@id': IRI; '@type': string; }

export interface ULD extends LogisticsObject {
  '@type': 'ULD';
  uldSerialNumber: string;          // e.g. "AKE12345JL"
  uldTypeCode: string;              // ATA designator code, e.g. "AKE"
  serviceabilityCode: 'SER' | 'DAM' | 'CON';
  damageFlag: boolean;
  sealNumber?: string;
  numberOfDoors?: number;
  ownerCode: string;                // 2-letter airline code, e.g. "EK"
  loadingIndicator?: string;
  ataDesignator?: string;
}

export interface Piece extends LogisticsObject {
  '@type': 'Piece';
  grossWeight: { value: number; unit: 'kg' | 'lb' };
  dimensions?: { length: number; width: number; height: number; unit: 'cm' };
  ofShipment: IRI;
  inPiece?: IRI;
  fulfillsUldTypeCode?: string;
  customsInformation?: IRI[];
  containedItems?: IRI[];
}

export interface Waybill extends LogisticsObject {
  '@type': 'Waybill';
  waybillPrefix: string;             // "176"
  waybillNumber: string;             // "12345678"
  arrivalLocation: IRI;
  departureLocation: IRI;
  declaredValueForCarriage?: { value: number; currency: string };
  shipmentDetails?: IRI;
  // app-side derived
  shc: string;                       // IATA SHC code (AVI/PER/COL/CRT/FRO/HEG)
  pieces: Piece[];
}

export interface TransportMovement extends LogisticsObject {
  '@type': 'TransportMovement';
  modeCode: 'Air';
  flightNumber: string;              // e.g. "EK0083"
  departureLocation: IRI;
  arrivalLocation: IRI;
  movementTimes: { type: 'STD' | 'STA' | 'ATD' | 'ATA'; timestamp: string }[];
  operatingParties: IRI[];
  loadingActions: IRI[];
}

export interface IotDevice extends LogisticsObject {
  '@type': 'IotDevice';
  serialNumber: string;
  attachedTo: IRI;                   // → ULD
}

export interface Sensor extends LogisticsObject {
  '@type': 'Sensor';
  sensorType: 'TEMPERATURE' | 'HUMIDITY' | 'GPS' | 'SHOCK' | 'BLE_PROXIMITY';
  serialNumber: string;
  partOfIotDevice: IRI;
}

export interface Measurement extends LogisticsObject {
  '@type': 'Measurement';
  measurementValue: { value: number; unit: string };
  measurementTimestamp: string;
  recordedGeolocation?: { latitude: number; longitude: number };
  bySensor: IRI;
}

export interface LogisticsEvent extends LogisticsObject {
  '@type': 'LogisticsEvent';
  eventCode: string;                 // "STATE_WAREHOUSE_IN" | "BREACH_PREDICTED" | ...
  eventName: string;
  eventDate: string;
  eventFor: IRI;                     // → ULD / Waybill / Piece
  eventLocation: IRI;
  eventTimeType?: 'planned' | 'actual';
  recordingActor?: IRI;
  recordingOrganization?: IRI;
}

export interface LogisticsAction extends LogisticsObject {
  '@type': 'LogisticsAction' | 'Loading' | 'Storing';
  actionStartTime: string;
  actionEndTime?: string;
  performedAt: IRI;                  // → Location
  servedActivity?: IRI;              // → LogisticsActivity (links action to flight or excursion)
  contactPersons?: IRI[];
  otherIdentifiers?: { type: string; value: string }[];
}

export interface Loading extends LogisticsAction {
  '@type': 'Loading';
  loadedPieces: IRI[];
  loadedUnits: IRI[];
  loadingType: string;
  onTransportMeans?: IRI;
  loadingPositionIdentifier?: string;
}

export interface DgDeclaration extends LogisticsObject {
  '@type': 'DgDeclaration';
  issuedForPiece: IRI;
  declarationDate: string;
  declarationPlace: IRI;
  departureLocation: IRI;
  arrivalLocation: IRI;
  complianceDeclarationText?: string;
  aircraftLimitationInformation?: string;
  exclusiveUseIndicator?: boolean;
  shippingRefNo?: string;
}

export interface TemperatureInstructions extends LogisticsObject {
  '@type': 'TemperatureInstructions';
  minTemperature: { value: number; unit: 'C' | 'F' };
  maxTemperature: { value: number; unit: 'C' | 'F' };
}
```

### Adapter pattern at API route boundary

```ts
// app/api/uld-inventory/route.ts
import { adaptMockUldInventory } from '@/lib/adapters/uld-inventory';
import fs from 'node:fs/promises';

export async function GET() {
  const raw = await fs.readFile('public/data/uld-inventory.json', 'utf-8');
  const canonical = adaptMockUldInventory(JSON.parse(raw));   // → ULD[]
  return Response.json({ data: canonical });
}
```

Future swap: replace `fs.readFile` with `fetch(realApi)` and write a new `adaptRealApi(...)`. Client never notices.

## Build-Up Flow (new)

Operator picks a flight from `/`, lands on `/flight/[flightNo]`. Workspace shows three coupled panels:

```
┌─ Flight EK0083 (DXB→FRA, ETD 14:20)                              [×] ─┐
├──────────────────────────────────────────────────────────────────────┤
│  AWB MANIFEST (8)                  ULD INVENTORY (12 avail)            │
│  ┌─────────────────────────┐       ┌─────────────────────────┐         │
│  │ ☐ 176-12345678  COL     │       │ AKE-12345EK  AKE  SER   │         │
│  │   PHARMA · 142 kg · 4pc │  →    │ AKE-22219EK  AKE  SER   │         │
│  │ ☐ 176-23456789  PER     │       │ RKN-99001EK  RKN  SER   │         │
│  │   FLOWERS · 89 kg · 2pc │       │ ...                      │         │
│  │ ☐ 176-34567890  AVI     │       │                          │         │
│  │   HORSES · 920 kg · 1pc │       │                          │         │
│  │ ...                      │       │                          │         │
│  └─────────────────────────┘       └─────────────────────────┘         │
│                                                                          │
│  BUILT ULDs FOR THIS FLIGHT (2)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ AKE-12345EK · COL · 3 AWBs · in-warehouse · 🟢 budget 11.2h     │  │
│  │ RKN-99001EK · AVI · 1 AWB  · in-tarmac    · 🟡 budget 1.4h      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

Click `+ Build new ULD` → `/flight/[flightNo]/build/[uldId]`:

```
┌─ Building AKE-12345EK for EK0083                                 [×] ─┐
├──────────────────────────────────────────────────────────────────────┤
│ ULD: AKE-12345EK  type AKE  owner EK  ser SER  seal _____             │
│ Pre-cool status: 🟢 internal 4.2°C · ready                            │
│                                                                        │
│ AWB MANIFEST (eligible)         CONTENTS                               │
│ ┌─────────────────────┐         ┌─────────────────────────────┐       │
│ │ 176-12345678  COL   │  drag→  │ 176-12345678  142 kg · COL  │       │
│ │ 176-23456789  PER   │         │ 176-23456789   89 kg · PER  │       │
│ │ 176-34567890  AVI   │  ✗ DG   │                              │       │
│ └─────────────────────┘         └─────────────────────────────┘       │
│                                                                        │
│ Validations                                                            │
│   ✅ DG check passed (DgDeclaration #DG-A91 issued)                   │
│   ✅ SHC compatibility OK (COL + PER both 2-8°C, no conflict)         │
│   ⚠ Predicted budget at ETD ambient 41°C: 8.2h (warning)              │
│                                                                        │
│ Total weight 231 kg · max 1500 kg                                      │
│                                                                        │
│ [Cancel]                                          [Sign off & seal]    │
└──────────────────────────────────────────────────────────────────────┘
```

**Build-up flow steps**:

1. Operator picks an available `:ULD` from inventory pool (filtered by station, `serviceabilityCode === 'SER'`, not `damageFlag`).
2. Drag eligible AWBs (`:Waybill`) from manifest panel into ULD contents area.
3. **DG check** fires per dropped piece. The DG API of record is **DG AutoCheck Connect v1** (see [`dg-autocheck-api/`](./dg-autocheck-api/)) — an async workflow, not stateless validation. Two operating modes:
   - **Stub mode** (default for demo): client posts `{ pieces, departure, arrival, flight }`; M3 stub looks up each piece IRI in `dg-declarations.json`; returns synchronous `valid`/`rejected`/`non-dg` per piece. Demo path. No external dependency.
   - **Real mode** (`DG_AUTOCHECK_ENABLED=true`, M23): client posts the same payload; server creates an Acceptance Check with DG AutoCheck, uploads any pre-issued XSDG/PDF, requests a single-use URL, returns `{ status: 'pending', requestedUrl, acceptanceCheckId }`. Build-up canvas opens the URL in a modal iframe; operator completes the doc + packaging check inside DG AutoCheck UI; webhook (`POST /api/webhooks/dg-autocheck`) fires `acceptance-check-passed`/`-failed`; build-up canvas DG row flips to ✅/❌ via zustand store; sign-off only allowed when all DG-declared pieces are `valid`.
   - In both modes: pieces with no pre-issued declaration return `non-dg`; pieces with a CAO-only DGD checked against a passenger flight return `rejected`. The semantics match — only the wire shape and async-ness differ.
   - The conservative read in our flow is: **DGDs are pre-issued by the shipper**. Build-up validates rather than authors. DG AutoCheck's role is to verify the documentation and packaging conform; DG AutoCheck's `passed` outcome is what we surface as `valid`.
4. **SHC compatibility check** (client-side, instant): pieces' `:TemperatureInstructions` must be reconcilable. Mixed COL (2-8°C) + CRT (15-25°C) blocked. Mixed COL + PER (both 2-8°C) allowed.
5. **Budget pre-flight check**: physics engine runs forecast against expected airside ambient curve. If predicted budget at ETD < safety margin, warning surfaced (non-blocking).
6. Sign-off: operator enters seal number, taps `Sign off & seal`. App emits:
   - One `:Loading` LogisticsAction (`loadedPieces`, `loadedUnits`, `actionStartTime`, `actionEndTime`, `performedAt = warehouse-cool-room`).
   - One `:LogisticsEvent` with `eventCode: 'BUILD_UP_COMPLETE'` and `eventFor: ULD-iri`.
   - Tracker simulator starts streaming `:Measurement`s for this ULD.
7. ULD enters tracking pipeline. State inferred from sensor + geofence — no manual handover step. Demo scenario timeline drives the geofence movement.

**TS modules**:
- `lib/build-up/dg-checker.ts` — wraps `POST /api/dg/check`
- `lib/build-up/shc-compat.ts` — pure function over `:TemperatureInstructions`
- `lib/build-up/budget-preflight.ts` — physics forecast hook
- `lib/build-up/sign-off.ts` — emits Loading + LogisticsEvent, kicks tracker

## SHC Config (`public/config/shc.json`)

Externalised special-handling-code tolerance database. Each entry maps to a `:TemperatureInstructions` plus a max-wait-vs-ambient curve (max-wait curve is our extension; ONE Record has no equivalent).

**Schema** (JSON):

```json
{
  "shc": {
    "AVI": {
      "label": "Live Animals",
      "description": "Live cargo - extreme temperature sensitivity",
      "temperatureInstructions": {
        "minTemperature": { "value": 18, "unit": "C" },
        "maxTemperature": { "value": 26, "unit": "C" }
      },
      "maxWaitMinutes": {
        "ambient25c": 90, "ambient30c": 45, "ambient35c": 30,
        "ambient40c": 15, "ambient45c": 10
      },
      "urgencyPriority": 1,
      "color": "#DC2626",
      "icon": "alert-octagon",
      "requiresVetClearance": true,
      "autoHoldThresholdMinutes": 20
    },
    "PER": {
      "label": "Perishable",
      "temperatureInstructions": { "minTemperature": { "value": 2, "unit": "C" }, "maxTemperature": { "value": 8, "unit": "C" } },
      "maxWaitMinutes": { "ambient25c": 240, "ambient30c": 120, "ambient35c": 90, "ambient40c": 45, "ambient45c": 30 },
      "urgencyPriority": 2, "color": "#F59E0B", "icon": "leaf", "autoHoldThresholdMinutes": 60
    },
    "COL": {
      "label": "Cool (Pharma 2-8°C)",
      "temperatureInstructions": { "minTemperature": { "value": 2, "unit": "C" }, "maxTemperature": { "value": 8, "unit": "C" } },
      "maxWaitMinutes": { "ambient25c": 360, "ambient30c": 180, "ambient35c": 120, "ambient40c": 60, "ambient45c": 45 },
      "urgencyPriority": 2, "color": "#3B82F6", "icon": "thermometer-snowflake", "autoHoldThresholdMinutes": 90
    },
    "CRT": {
      "label": "Controlled Room Temp 15-25°C",
      "temperatureInstructions": { "minTemperature": { "value": 15, "unit": "C" }, "maxTemperature": { "value": 25, "unit": "C" } },
      "maxWaitMinutes": { "ambient25c": 999, "ambient30c": 360, "ambient35c": 240, "ambient40c": 120, "ambient45c": 90 },
      "urgencyPriority": 3, "color": "#6B7280", "icon": "thermometer", "autoHoldThresholdMinutes": 120
    },
    "FRO": {
      "label": "Frozen (-20°C)",
      "temperatureInstructions": { "minTemperature": { "value": -25, "unit": "C" }, "maxTemperature": { "value": -15, "unit": "C" } },
      "maxWaitMinutes": { "ambient25c": 180, "ambient30c": 90, "ambient35c": 60, "ambient40c": 30, "ambient45c": 20 },
      "urgencyPriority": 1, "color": "#06B6D4", "icon": "snowflake", "autoHoldThresholdMinutes": 30
    },
    "HEG": {
      "label": "Hatching Eggs",
      "temperatureInstructions": { "minTemperature": { "value": 18, "unit": "C" }, "maxTemperature": { "value": 22, "unit": "C" } },
      "maxWaitMinutes": { "ambient25c": 120, "ambient30c": 60, "ambient35c": 30, "ambient40c": 20, "ambient45c": 10 },
      "urgencyPriority": 1, "color": "#DC2626", "icon": "egg", "autoHoldThresholdMinutes": 25
    }
  },
  "default": {
    "temperatureInstructions": { "minTemperature": { "value": 15, "unit": "C" }, "maxTemperature": { "value": 25, "unit": "C" } },
    "maxWaitMinutes": { "ambient25c": 480, "ambient30c": 240, "ambient35c": 180, "ambient40c": 120, "ambient45c": 60 },
    "urgencyPriority": 4, "color": "#9CA3AF", "icon": "package", "autoHoldThresholdMinutes": 240
  }
}
```

**Lookup function** (`lib/scheduler/shc-loader.ts`):

```ts
export function maxWaitForShc(shc: string, ambientC: number, cfg: ShcConfig): number {
  const entry = cfg.shc[shc] ?? cfg.default;
  const points = Object.entries(entry.maxWaitMinutes)
    .map(([k, v]) => [parseFloat(k.replace(/[^\d]/g, '')), v as number]);
  return linearInterpolate(points, ambientC);
}

export function temperatureInstructionsForShc(shc: string, cfg: ShcConfig): TemperatureInstructions {
  return (cfg.shc[shc] ?? cfg.default).temperatureInstructions;
}
```

**Why JSON config**: ops can tune per-station, demo-friendly, hot-reloadable, IATA defines ~80 SHCs (we ship 6 in demo and document extensibility).

## Data Sources

> Concrete fixture content (entity IDs, AWB rows, ULD inventory split, DG placeholders, scenario impact matrix) lives in [`MOCK_DATA.md`](./MOCK_DATA.md). This table only enumerates the source surfaces.

| Source | Mode | Path / Endpoint | Use |
|---|---|---|---|
| Weather (current + forecast) | **Live primary** | `https://api.open-meteo.com/v1/forecast?...` (proxied via `/api/weather`) | Real ambient + hourly forecast for DXB |
| Weather fallback | Mock | `/public/data/weather/DXB.json` | Pre-baked ambient when Open-Meteo unavailable |
| ULD telemetry stream | **Live primary + synthetic fallback** | One Connect subscription/proxy notifications → `/api/one-connect/uld-telemetry`; fallback in-browser tick loop | Location/GPS + ambient/internal temperature as `:Measurement[]` for state inference, thermal budget, alerts. Synthetic feed remains deterministic demo fallback. |
| Flight schedule + delay | Mock | `/api/flights` → `/public/data/flights.json` | Today's outbound at DXB as `:TransportMovement[]`. Adapter shape ready for real carrier API. |
| Shipment manifest (per flight) | **Live optional + mock fallback** | One Connect Waybill subscription/proxy notifications; fallback `/api/flights/[no]/shipments` → `/public/data/shipments.json` | AWBs as `:Waybill[]` with pieces + SHC. One Connect hydrates the same canonical shapes used by the mock adapter. |
| ULD inventory | Mock | `/api/uld-inventory` → `/public/data/uld-inventory.json` | Available ULDs at DXB as `:ULD[]`. |
| DG check | **Live** (hackathon-provided) | `POST /api/dg/check` → external API | Per-piece DG validation. Adapter to/from `:DgDeclaration`. Spec arrives during hackathon. |
| Static airport polygon GeoJSON | Mock | `/public/data/airports/DXB.geojson` | Geofence boundaries (apron, cool room, build-up area, gates) for DXB |
| Station capability registry | Mock | `/public/config/stations.json` | Cool-dolly count, cool-room slots, GPU policy, CEIV cert (DXB only) |
| ULD product specs | Mock | `/public/config/uld-specs.json` | PCM autonomy curves for Envirotainer RAP-COL, va-Q-tainer, Sonoco Pegasus |
| Demo scenario script | Mock | `/public/data/scenarios.json` | Scripted timeline of injectable events |

### One Connect / 1Neo-Connect integration pattern

The hackathon One Connect collection in `one-connect/collection.json` exposes:

- OAuth client-credentials token retrieval from `{{idp_url}}`.
- `GET {{1R_api_url}}` for ONE Record server information / connectivity checks.
- `POST {{1R_api_url}}/logistics-objects` for publishing canonical objects as JSON-LD.
- `POST {{taxon_1R_url}}/subscriptions` for `Waybill` and ULD-related topic subscriptions.
- `GET {{proxy_url}}/notifications?limit=20` for cached notification polling when local webhooks are unavailable.

**Inbound telemetry** is now a first-class integration. One Connect subscription notifications for ULD / IoT / Sensor / Measurement objects are normalized server-side into the existing canonical stream:

```
One Connect notification
  → fetch linked LogisticsObject(s) when needed
  → adaptOneConnectMeasurement(...)
  → Measurement[] with measurementValue, measurementTimestamp, recordedGeolocation, bySensor
  → state inference + PCM physics + recommender
```

The adapter should preserve the existing `lib/simulator/tracker-feed.ts` listener contract so UI and compute modules do not care whether a measurement came from One Connect or the synthetic scenario runner. When `ONE_CONNECT_ENABLED !== 'true'`, the current in-browser tracker simulator remains the default for deterministic demo playback.

**Inbound Waybills** use the same pattern: One Connect notifications hydrate `:Waybill[]` and `:Piece[]`, while `public/data/shipments.json` remains the fallback. The flight workspace continues consuming `/api/flights/[flightNo]/shipments`.

**Outbound publish** happens after the app adds value:

- Build-up sign-off publishes `:Loading` + `BUILD_UP_COMPLETE`.
- State inference may publish state-change `:LogisticsEvent`s.
- Breach prediction / actual excursion publishes `WARNING_BUDGET_LOW`, `BREACH_PREDICTED`, `BREACH_ACTUAL`.
- Resolution actions publish `:LogisticsAction` records linked by `servedActivity`.

Credentials live only in `.env.local`; the committed `one-connect/environment.example.json` is a placeholder. Never commit exported Postman environments with real `client_secret` values.

### Open-Meteo integration pattern

Primary weather source is **Open-Meteo** (free, no API key, CORS-enabled). Now wrapped in `GET /api/weather` server route to centralise caching + fallback (instead of calling Open-Meteo directly from the browser).

```ts
// app/api/weather/route.ts
import { NextRequest } from 'next/server';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

export async function GET(req: NextRequest) {
  const airport = req.nextUrl.searchParams.get('airport') ?? 'DXB';
  const coords = AIRPORT_COORDS[airport];
  const url = `${OPEN_METEO_BASE}?latitude=${coords.lat}&longitude=${coords.lon}&hourly=temperature_2m,relative_humidity_2m,cloud_cover&forecast_days=2&timezone=auto`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const raw = await res.json();
    return Response.json({ source: 'live', ...normalizeOpenMeteo(raw) });
  } catch (err) {
    const mock = await fs.readFile(`public/data/weather/${airport}.json`, 'utf-8');
    return Response.json({ source: 'mock', ...JSON.parse(mock) });
  }
}
```

Client caches response in `sessionStorage` per session for deterministic demo. UI surfaces `🟢 LIVE` / `⚪ MOCK` badge from the `source` field.

**ULD tracker note**: One Connect can provide a ULD subscription stream with location and temperature data for the hackathon path. Synthetic tracker feed is no longer the architectural primary; it is the deterministic fallback used when `ONE_CONNECT_ENABLED !== 'true'` or when notification polling is unavailable.

## Map / Geo Visualisation

Goal: render the ULD's location end-to-end of its lifecycle without paid keys. Two map surfaces in the app:

1. **Airport map** — Leaflet view zoomed to DXB, overlays the geofence sub-zones from `DXB.geojson`, drops a pin at the ULD's current GPS. Used in `/uld/[uldId]` (M14) and on supervisor dashboard popovers.
2. **Flight overview map** — Leaflet view zoomed to fit origin → arrival great-circle line, drops a pin at the ULD's interpolated in-flight position. Used in the same drill-down when state is `in-flight` or `arrived-tarmac`.

### Library

- **`react-leaflet` + `leaflet`** — React wrapper over Leaflet. Already in M0 dependencies.
- **No API key**, no auth, runs fully client-side, raster tiles delivered via CDN.

### Tile providers (free, no key, theme-aware)

| Theme | Tile URL | Attribution (required) |
|---|---|---|
| **dark (default)** | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` (CartoDB Dark Matter) | `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>` |
| light | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` (Carto Voyager) | same as above |
| fallback | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (OSM raw) | `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors` |

CartoDB tiles are CDN-hosted, retina (`{r}` → `@2x`), and have a generous unauthenticated quota. They're the default to match our dark theme. OSM raw is the fallback if Carto returns 4xx/5xx.

`components/airport-map.tsx` switches `<TileLayer url={...} attribution={...}>` based on `next-themes` theme value. **Attribution must remain visible** — Leaflet renders it bottom-right by default; do not hide it.

### Coordinate sources

- **Airport coordinates** — see [`MOCK_DATA.md`](./MOCK_DATA.md) → **Airport coordinates**. DXB origin + FRA / LHR / JFK / SIN arrivals.
- **DXB sub-zone polygons** — see `public/data/airports/DXB.geojson` (lat/lon polygons per MOCK_DATA.md → DXB Geofence). Approximate; not survey-grade.
- **In-flight ULD position** — live from One Connect `:Measurement.recordedGeolocation` when available; otherwise interpolated by the tracker simulator (M8) along a great-circle path between airport coords and rendered as a moving pin on the flight overview map.

### Implementation pattern

```tsx
// components/airport-map.tsx
'use client';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';

const TILES = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

export function AirportMap({ center, zoom, geojson, uldPosition }: Props) {
  const { resolvedTheme } = useTheme();
  const tile = TILES[resolvedTheme === 'dark' ? 'dark' : 'light'];
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full rounded-xl">
      <TileLayer url={tile.url} attribution={tile.attribution} />
      {geojson && <GeoJSON data={geojson} style={zoneStyle} />}
      {uldPosition && (
        <Marker position={uldPosition}>
          <Popup>ULD here</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
```

### SSR caveat

Leaflet touches `window`. The map must be loaded as a client component, **dynamically imported with `ssr: false`** in any server component parent:

```tsx
// app/uld/[uldId]/page.tsx
import dynamic from 'next/dynamic';
const AirportMap = dynamic(() => import('@/components/airport-map').then(m => m.AirportMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse rounded-xl" />,
});
```

### Free-tier limits + fallback

CartoDB and OSM tiles are unauthenticated and rate-limited per IP. For the demo (a single deployed Vercel URL with judges + operator on a handful of devices) this never bites. If a tile request 4xx/5xx-s, Leaflet shows a grey square — acceptable; no need to engineer retry logic for hackathon.

If demand is unexpectedly high during judging, swap to OSM raw as a one-line URL change. No key swap, no rebuild needed.

## Tech Stack

- **Framework**: **Next.js 15** + TypeScript + **Tailwind CSS v4** + **shadcn/ui** (App Router). **Desktop-first** layouts; no PWA install prompt or service worker required (drop next-pwa).
- **Design system**: see [`style-guide.json`](./style-guide.json) — single source of truth for tokens (colors, type, spacing, components). Summary in next section.
- **Theming**: `next-themes` for theme switching, **default dark**. Tokens in OKLCH color space, defined as CSS variables in `app/globals.css`.
- **Typography**: **Geist Mono** (monospace) via `next/font/google`, exposed as `--font-geist-mono`.
- **Component variants**: `class-variance-authority` (cva) for button/badge variants, `clsx` + `tailwind-merge` via `cn()` helper.
- **Animations**: `tw-animate-css` for Radix UI primitives (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`).
- **Icons**: `lucide-react`.
- **Geometry**: `@turf/turf` — `booleanPointInPolygon` for geofence inference.
- **Charts**: `recharts` — thermal budget time-series. Series colors map to brand-orange palette (chart-1 → orange-600/500 light/dark, chart-2..5 per style guide).
- **Map**: `react-leaflet` + free raster tiles (OSM + CartoDB Dark Matter / Voyager). Single-station DXB view + in-flight overview (origin → arrival great-circle line). **No API key required.** See **Map / Geo Visualisation** section below.
- **State**: `zustand` for global state (flights, ULD list, demo clock, mock resources), `localStorage` middleware for prefs.
- **Storage tiers**:
  - `localStorage` — user role, language, executed-actions log, force-mock weather toggle
  - `sessionStorage` — current demo state, mock inventory mutations, weather cache, active alerts
  - `IndexedDB` (via `dexie`) — audit logs (excursions, resolutions, transitions). Survives reload.
- **Notifications**: native Web Notifications API (in-app fallback toasts via shadcn `toast`). Used for tracking-stage alerts.
- **API runtime**: Node runtime for `/api/*` routes (need `fs` for mock JSON in dev). Consider Edge runtime for `/api/weather` later if cold-start matters.
- **Deploy**: Vercel (single deploy, free tier).

Justification for the small-BE shape: Next.js API routes give us a clean adapter seam for external integrations (DG, weather, future carrier API) without the deploy/infra overhead of a separate backend service. No DB; routes stay stateless.

## Design System

Authoritative tokens live in [`style-guide.json`](./style-guide.json). Inline summary so agents do not re-derive:

**Color** — OKLCH, dark default. Brand orange palette (`oklch(0.705 0.213 47.604)` is `orange-500` accent, `oklch(0.646 0.222 41.116)` is `orange-600` primary). Theme tokens (`background`, `foreground`, `card`, `primary`, `muted`, `destructive`, `border`, etc.) defined per theme in `app/globals.css` as CSS variables; consumed via Tailwind utilities like `bg-card`, `text-foreground`, `border-border`. **Never hardcode hex** — always go through tokens.

**Status colors** — `bg-orange-500/10 text-orange-500` for warning, `bg-primary/10 text-primary` for info, `bg-muted text-muted-foreground` for neutral. SHC badges in `shc.json` should override only the `color` field; everything else flows from tokens.

**Type** — Geist Mono everywhere. Scale tied to usage:
- `text-xs` — badges, small labels
- `text-sm` — descriptions, helper text, button text
- `text-base` — body, inputs
- `text-lg font-semibold leading-none` — card titles, dialog titles
- `text-xl` — section headings
- `text-2xl` — page titles
- `text-7xl md:text-9xl font-bold tracking-tighter` — dashboard hero stats (e.g., "ULDs at risk" big number on supervisor view)

**Spacing** — 4px base unit. Standard patterns: `p-6` card padding, `px-6` navbar/section padding, `gap-2 / gap-4 / gap-6` for component gaps, `mb-4 / mb-8 / mb-12 / mb-16` for section spacing. Container `max-w-7xl mx-auto`.

**Radius** — `rounded-md` buttons/inputs, `rounded-xl` cards, `rounded-full` badges, `rounded-lg` dialogs.

**Shadows** — `shadow-xs` inputs/buttons, `shadow-sm` cards, `shadow-md` dropdowns, `shadow-lg` dialogs. Hover glow on interactive cards: `hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50`.

**Focus rings** — `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` on all interactive elements.

**Components** — use **shadcn/ui** primitives only; do not hand-roll button/input/card/dialog/badge/table/tabs/dropdown/scroll-area/separator/toast/switch/progress/checkbox. Install via `pnpm dlx shadcn@latest add <component>`. Variants via `cva` matching the style-guide spec.

**`/shadcn` skill — MANDATORY for FE work.** Any agent (or the orchestrator) building or editing a UI layout MUST invoke the `/shadcn` skill before writing component code. The skill provides current component docs, registry context, install commands, composition examples. This is non-negotiable — it prevents drift from shadcn API, bypasses guesswork on prop shapes, and surfaces newer primitives we may not be tracking. Applies for: every milestone in Phase 3 (M11–M19), any cross-cutting component creation in Phase 2 build-up logic that needs a UI counterpart, and any polish work in M20.

**Helpers** — `cn()` in `lib/utils.ts` (clsx + tailwind-merge). Always use `cn()` to merge Tailwind classes; never string concatenation.

**Layout patterns** — navbar `sticky top-0 z-50 h-14 px-6 border-b bg-background/95 backdrop-blur`; main content `max-w-7xl mx-auto px-6 py-8`; major-feature grid `grid gap-4 md:grid-cols-3`; secondary-feature grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.

**Animations** — `tw-animate-css` patterns for Radix primitives. Custom keyframes for hero (`heroValuePulse`) and slide-in (`fadeInSlideRight`, `fadeInSlideLeft`) per style-guide.

## Action Library (subset — ~25 actions across 10 categories)

Same as original PLAN minus transit-specific T1-T7. Each action serialised as `:LogisticsAction` per ONE Record.

| # | Category | Action | Benefit | Cost | Auth |
|---|---|---|---|---|---|
| 1 | Relocate (warehouse) | Move to certified cool room | +6-12h | Free | Handler |
| 2 | Relocate (warehouse) | Stage near AC vent | +2-4h | Free | Handler |
| 3 | Augment (warehouse) | Apply thermal blanket | +2-5h | Low | Handler |
| 4 | Schedule (build-up) | Priority build-up slot | +1-3h | Operational | Supervisor |
| 5 | Substitute (warehouse) | Re-pre-condition PCM packs | Reset budget | Mid | Service ctr |
| 6 | Augment (transit) | Use refrigerated cool dolly | +3-6h | Mid | Handler |
| 7 | Augment (transit) | Insulated thermal tarp | +1-2h | Low | Handler |
| 8 | Schedule (transit) | Tow during cooler window | +2-4h | Operational | Supervisor |
| 9 | Relocate (airside) | **Park in jet-bridge shadow** | +2-5h | Free | Handler |
| 10 | Relocate (airside) | Park in aircraft tail shadow | +1-3h | Free | Handler |
| 11 | Augment (airside) | Reflective tarp / silver cover | +2-4h | Low | Handler |
| 12 | Augment (airside) | Wet-rag evaporative cooling | +1-2h | Free | Handler |
| 13 | Schedule (airside) | Request priority loading slot | +1-3h | Operational | Loadmaster |
| 14 | Augment (loaded) | Aircraft GPU + AC pre-cool | +3-6h | High | Airline ops |
| 15 | Augment (loaded) | Keep cargo door closed | +1-2h | Free | Loadmaster |
| 16 | Schedule (delay) | Reposition aircraft to shaded gate | +2-4h | Operational | Tower |
| 17 | Escalate (network) | Swap to fresh passive ULD | Reset | High | Forwarder |
| 18 | Escalate (network) | Swap to active ULD | Indefinite | Very high | Forwarder |
| 19 | Escalate (route) | Reroute via cooler hub | Variable | High | Forwarder |
| 20 | Schedule (origin) | Hold + re-book later flight | Avoids exposure | High | Shipper |
| 21 | Document (no mitigation) | Pre-emptive deviation report | Forensic | Free | Auto |
| 22 | Document (no mitigation) | Notify shipper for batch hold | Faster CAPA | Free | Auto |
| 23 | Document (no mitigation) | Insurance pre-notification | Faster claim | Free | Auto |

Transit-specific T1-T7 are dropped along with the transit sub-states.

## Supervisor Surfaces — ULD Tracker + Audit Logs

Supervisor view is a tab inside the warehousing app, not a separate app. Same four surfaces as original.

### 1. Live ULD Tracker Dashboard (`/supervisor`)

Real-time list of every built ULD across today's outbound flights at DXB. Sortable table columns:

| Column | Content |
|---|---|
| ULD ID | `uldSerialNumber`, e.g. `AKE-12345EK` |
| ULD type | `uldTypeCode` + product (RAP-COL, va-Q-tainer XL, Pegasus CRT) |
| SHC badge | AVI/PER/COL/CRT/FRO/HEG with color + icon from `shc.json` |
| Stage | 5-stage state (`in-warehouse` / `in-tarmac` / `in-flight` / `arrived-tarmac` / `arrived-destination`) |
| Internal °C | Live from `:Measurement` stream |
| Ambient °C | Tracker + weather fusion |
| Budget remaining | Hours, color-coded 🟢 >50% / 🟡 30-50% / 🔴 <30% |
| Outbound flight | `flightNumber` + ETD + delay state |
| Status | 🟢 OK / 🟡 Alert / 🔵 Action in progress / 🔴 Excursion |

Header: LIVE/MOCK weather source badge, station name (DXB), resource counters (free cool dollies, free cool-room slots).

Click ULD → `/uld/[uldId]`:
- Live airport map (Leaflet, single-station DXB zoom)
- Time-series chart (Recharts) — internal temp + ambient + PCM budget curve with predicted breach line
- Current state inference with confidence
- Pending/active action card if any
- Tabs: History · Timeline · Raw measurements (JSON viewer of `:Measurement[]`)

### 2. Potential Excursion Log (`/supervisor/excursions`)

Chronological log of every predicted or actual temperature-threshold event across all built ULDs. Each entry is a `:LogisticsEvent` with custom `eventCode`. Filterable by ULD, date range, SHC, severity.

| Severity | eventCode | Trigger | Badge |
|---|---|---|---|
| Warning | `WARNING_BUDGET_LOW` | Budget drops below 30% of ULD's rated autonomy | 🟡 |
| Alert | `BREACH_PREDICTED` | Breach predicted within next 60 minutes | 🟠 |
| Excursion | `BREACH_ACTUAL` | Internal temperature crossed SHC threshold | 🔴 |

Each entry records: timestamp (`eventDate` + wall clock), ULD IRI (`eventFor`), state at trigger, ambient + internal °C, forecast curve, predicted breach time, root-cause inference (tarmac exposure / flight delay / PCM pre-conditioning failure / etc.), linked resolution (LogisticsAction IRI), affected outbound flight.

### 3. Resolution Log (`/supervisor/resolutions`)

Paired history of `:LogisticsAction` records taken in response to excursion events. Filterable by ULD, date, action category, outcome.

Each entry records: `actionStartTime` / `actionEndTime`, linked excursion `:LogisticsEvent` IRI, action library reference, actor (handler / supervisor / `auto-dispatch`), claimed thermal benefit (h), actual measured benefit (h), outcome (`averted` / `breached-anyway` / `monitoring` / `cancelled`), station capability context at time of action, execution time (alert-fire to EXECUTE-tap latency).

Aggregates: pie chart of outcomes, bar chart of most-used actions, scatter plot of claimed-vs-actual benefit per action type (calibrates ranker).

### 4. Per-ULD Audit Timeline (`/supervisor/audit/[uldId]`)

Combined chain-of-custody timeline. Combines `:LogisticsEvent`s, `:LogisticsAction`s, `:Loading` events, weather/flight events, threshold crossings.

Bottom: auto-drafted deviation report (Markdown, one-click export as PDF) when any excursion occurred.

### Audit DB

Persist via IndexedDB through Dexie wrapper (`lib/persistence/audit-db.ts`). Three tables, all storing canonical IATA shapes.

```ts
// lib/persistence/audit-db.ts
import Dexie, { Table } from 'dexie';
import type { LogisticsEvent, LogisticsAction } from '@/lib/ontology/one-record';

class AuditDB extends Dexie {
  events!: Table<LogisticsEvent, string>;       // excursions + transitions
  actions!: Table<LogisticsAction, string>;     // resolutions + Loading actions
  loadings!: Table<Loading, string>;            // build-up actions

  constructor() {
    super('cool-chain-copilot-audit');
    this.version(1).stores({
      events:    '@id, eventFor, eventDate, eventCode',
      actions:   '@id, performedAt, actionStartTime, servedActivity',
      loadings:  '@id, actionStartTime, *loadedUnits, *loadedPieces',
    });
  }
}

export const auditDb = new AuditDB();
```

## Demo Control Panel

Same architecture as original PLAN. Operator surface at `/dev/control` with scenario library, play/pause/skip/reset, time-of-day override, force-mock weather, manual injection.

### Scenario JSON schema

```json
{
  "scenarios": [
    {
      "id": "dxb-warehouse-demo",
      "name": "DXB Warehouse Demo — Build EK0083, alert mid-tarmac",
      "description": "Operator opens warehousing app, picks EK0083 (DXB→FRA), builds a COL ULD with 3 AWBs, watches it leave warehouse, alert fires mid-tarmac as ambient hits 41°C, mitigation executed, audit timeline. ★ Main demo.",
      "duration_seconds": 180,
      "tags": ["main-demo", "build-up", "tarmac-alert"],
      "initial_state": {
        "station": "DXB",
        "time_of_day": "afternoon",
        "weather_override": { "ambient_c": 38, "humidity_pct": 60, "cloud_cover_pct": 30 },
        "flights": ["EK0083", "EK0237", "EK0411"],
        "uld_inventory": "default",
        "resources": { "cool_dollies_free": 2, "cool_room_slots_free": 65 }
      },
      "events": [
        { "at_s": 0, "type": "scenario_start", "label": "Operator opens warehousing app" },
        { "at_s": 5, "type": "ui_focus", "target": "flight_list" },
        { "at_s": 15, "type": "ui_focus", "target": "flight_workspace", "flightNo": "EK0083" },
        { "at_s": 25, "type": "ui_focus", "target": "build_up_canvas", "uldId": "AKE-12345EK" },
        { "at_s": 30, "type": "auto_drag", "awbs": ["176-12345678", "176-23456789"], "into": "AKE-12345EK" },
        { "at_s": 40, "type": "dg_check_complete", "uldId": "AKE-12345EK", "result": "pass" },
        { "at_s": 45, "type": "build_up_signoff", "uldId": "AKE-12345EK" },
        { "at_s": 50, "type": "weather_ramp", "param": "ambient_c", "from": 38, "to": 42, "over_s": 30 },
        { "at_s": 60, "type": "uld_state_force", "uldId": "AKE-12345EK", "state": "in-tarmac" },
        { "at_s": 90, "type": "physics_recompute", "uldId": "AKE-12345EK" },
        { "at_s": 95, "type": "notification", "uldId": "AKE-12345EK", "title": "AKE-12345EK breach in 38 min", "body": "Tap for 3 actions" },
        { "at_s": 95, "type": "ui_focus", "target": "uld_detail", "uldId": "AKE-12345EK" },
        { "at_s": 120, "type": "wait_for_user_action", "expected": "execute_action_2", "fallback_after_s": 15 },
        { "at_s": 135, "type": "uld_action_complete", "uldId": "AKE-12345EK", "action": "cool_dolly_retrieve", "budget_recovery_h": 5 },
        { "at_s": 150, "type": "ui_focus", "target": "audit_log", "uldId": "AKE-12345EK" },
        { "at_s": 165, "type": "ui_focus", "target": "pitch_slide" },
        { "at_s": 180, "type": "scenario_end" }
      ]
    },
    {
      "id": "dxb-quiet-shift",
      "name": "DXB Quiet Shift — Cool evening, no alerts",
      "description": "Cool ambient (28°C), no delays, baseline normal-day operator experience with no alerts firing.",
      "duration_seconds": 60,
      "tags": ["baseline", "cool", "quiet-day"],
      "initial_state": {
        "station": "DXB",
        "time_of_day": "evening",
        "weather_override": { "ambient_c": 28, "humidity_pct": 55, "cloud_cover_pct": 40 },
        "flights": ["EK0083"],
        "resources": { "cool_dollies_free": 5, "cool_room_slots_free": 200 }
      },
      "events": [
        { "at_s": 0, "type": "scenario_start" },
        { "at_s": 60, "type": "scenario_end", "summary": "All ULDs operated normally, zero alerts." }
      ]
    },
    {
      "id": "dxb-cascading-delays",
      "name": "DXB Cascading Delays — 3 outbound flights delayed",
      "description": "Severe weather causes cascading delays across 3 outbound flights. Multiple built ULDs at risk simultaneously — tests recommender prioritization.",
      "duration_seconds": 200,
      "tags": ["stress-test", "cascading", "multi-uld"],
      "initial_state": { "station": "DXB", "time_of_day": "afternoon", "weather_override": { "ambient_c": 41, "humidity_pct": 70, "cloud_cover_pct": 80 } },
      "events": [
        { "at_s": 0, "type": "scenario_start" },
        { "at_s": 30, "type": "flight_delay", "flight": "EK0083", "delta_min": 90 },
        { "at_s": 45, "type": "flight_delay", "flight": "EK0237", "delta_min": 75 },
        { "at_s": 60, "type": "flight_delay", "flight": "EK0411", "delta_min": 60 },
        { "at_s": 200, "type": "scenario_end" }
      ]
    },
    {
      "id": "custom",
      "name": "Custom Sandbox",
      "description": "No scripted events. Use manual `/dev/inject` for ad-hoc events.",
      "duration_seconds": null,
      "tags": ["sandbox"]
    }
  ]
}
```

### Event types (dispatch table)

| Event type | Effect |
|---|---|
| `scenario_start` | Reset all state, load `initial_state`, focus opening UI |
| `scenario_end` | Halt timer, show end-of-scenario summary |
| `flight_delay` | Update flight schedule, trigger physics + scheduler recompute |
| `weather_override` | Set ambient curve (instant) |
| `weather_ramp` | Linear interpolate ambient over `over_s` seconds |
| `time_of_day_change` | Adjust ambient curve baseline + UI theme |
| `auto_drag` | Programmatically drop AWBs into a ULD (build-up demo) |
| `dg_check_complete` | Mock DG check pass/fail for a given ULD |
| `build_up_signoff` | Programmatically sign off a built ULD, emit Loading + LogisticsEvent |
| `uld_state_force` | Force ULD state (bypasses inference for demo control) |
| `physics_recompute` | Force immediate physics tick for named ULD |
| `notification` | Fire Web Notification with `title`, `body`, deep-link to `/uld/[uldId]` |
| `ui_focus` | Switch active route (`flight_list`, `flight_workspace`, `build_up_canvas`, `uld_detail`, `supervisor_dashboard`, `audit_log`, `pitch_slide`) |
| `wait_for_user_action` | Pause until user performs `expected` action OR fallback timer fires |
| `uld_action_complete` | Mock-execute action; mutate resource state; recover budget |
| `alert` | Show in-app alert (not browser notification) |

## Demo Scenario (3 minutes, scripted, deterministic)

**Setup**: Operator at DXB warehouse, desktop in front, today's outbound flights pulled. Three flights for the demo:
- EK0083 (DXB→FRA, ETD 14:20)
- EK0237 (DXB→LHR, ETD 14:50)
- EK0411 (DXB→JFK, ETD 15:30)

13 AWBs across these flights, mix of COL / PER / AVI / CRT / FRO + 2 DG-declared. 12 ULDs available in DXB inventory pool. Full fixture detail in [`MOCK_DATA.md`](./MOCK_DATA.md).

**Demo arc** — every row below is a 1:1 reflection of an event in `dxb-warehouse-demo` scenario JSON (`scenarios.json`). The scenario runner (M19) drives every transition automatically; operator narrates only.

| t (sec) | JSON event | Observable | UI surface |
|---|---|---|---|
| 0 | `scenario_start` "Operator opens warehousing app" | Reset state, load initial fixtures, weather override 38°C | — |
| 5 | `ui_focus` `flight_list` | Flight list renders 3 outbound flights (EK0083, EK0237, EK0411). 🟢 LIVE weather badge. All flights green. | `/` |
| 15 | `ui_focus` `flight_workspace` (EK0083) | Three-panel workspace: 4 AWBs in manifest (COL pharma, PER flowers, AVI horses, CRT/DG smartphones), 12 ULDs in inventory, empty tracking strip. | `/flight/EK0083` |
| 25 | `ui_focus` `build_up_canvas` (AKE-12345EK) | Build-up canvas opens. ULD pre-cool 4.2°C ✅. | `/flight/EK0083/build/AKE-12345EK` |
| 30 | `auto_drag` (176-12345678 + 176-23456789 → AKE-12345EK) | Both AWBs animate into the ULD contents area. | (canvas) |
| 40 | `dg_check_complete` (pass) | M9 dgChecker.validate fires via POST /api/dg/check → no DGD on file for COL/PER pieces → returns `non-dg` → DG row ✅. SHC compat ✅ (both 2-8°C). Budget pre-flight 11.2h ✅. Total 231 kg. | (canvas validation rows) |
| 45 | `build_up_signoff` (AKE-12345EK) | Seal `EK-S-991023` entered (auto-filled). Sign-off emits `:Loading` + `:LogisticsEvent BUILD_UP_COMPLETE` (M9 → M10). ULD enters tracking strip. State: `in-warehouse`. IOT-001 starts streaming `:Measurement[]`. | back to `/flight/EK0083` |
| 50 | `weather_ramp` (38°C → 42°C over 30s) | Ambient climbs visibly in tracker chart. | (workspace tracking strip) |
| 60 | `uld_state_force` (AKE-12345EK → `in-tarmac`) | Geofence transition (forced by scenario). Physics recomputes — budget shrinks. | (tracking strip live) |
| 90 | `physics_recompute` (AKE-12345EK) | Budget projection updates: 4h to predicted breach. Yellow → red. | (tracking strip + bar) |
| 95 | `notification` (BREACH_PREDICTED) + `ui_focus` `uld_detail` | Web Notification "AKE-12345EK breach in 38 min". UI auto-navigates to drill-down. Top-3 action cards render. | `/uld/AKE-12345EK` |
| | **TOP 3 ACTIONS** | 🟢 #1 Park in jet-bridge shadow — saves 3.5h · 4 min · no approval — [EXECUTE]<br>🟡 #2 Retrieve cool dolly from Pool-North — saves 5h · 12 min · 2 dollies free — [REQUEST]<br>🔴 #3 Push priority loading slot 7→2 — saves 2h · needs loadmaster — [ESCALATE] | (drill-down action card) |
| 120 | `wait_for_user_action` (expected `execute_action_2`, fallback 15s) | Scenario clock pauses. Operator clicks EXECUTE on action #2. M10 resolution-logger writes `:LogisticsAction` linked via `servedActivity` to the BREACH_PREDICTED event. | (drill-down) |
| 135 | `uld_action_complete` (cool_dolly_retrieve, +5h) | Budget recovers 4h → 9h. Big green confirmation. Bar refills. | (drill-down) |
| 150 | `ui_focus` `audit_log` (AKE-12345EK) | UI navigates to per-ULD audit timeline. Shows: Loading event, STATE_WAREHOUSE_IN, STATE_TARMAC_IN, weather ramp, BREACH_PREDICTED, executed `:LogisticsAction`, outcome `averted`. Auto-drafted deviation report Markdown preview, [Export PDF] button. | `/supervisor/audit/AKE-12345EK` |
| 165 | `ui_focus` `pitch_slide` | Closing slide: *"Today's warehousing systems show what's in the manifest. We bake cool-chain physics into the build-up screen — same Jettainer telemetry, same SHC config, decided in the workspace where the operator lives. IATA ONE Record-shaped from day one — when real APIs land, we just swap adapters."* | `/pitch` |
| 180 | `scenario_end` | Halt. Summary modal. RESET available. | — |

## Hackathon Build Plan (1-2 days, solo)

> Detailed milestone-by-milestone tracking with success/test criteria, owners, and revisions lives in [`MILESTONES.md`](./MILESTONES.md). The hour-budget below is the original time-box; refer to MILESTONES.md for live status and parallel-safe execution rules.

| Hour | Task |
|---|---|
| 0-1 | Scaffold Next.js 14 + TS + Tailwind + shadcn/ui + zustand, repo init, deploy hello-world to Vercel |
| 1-2 | **IATA ONE Record TS types** (`lib/ontology/one-record.ts`) covering ULD, Piece, Waybill, TransportMovement, IotDevice, Sensor, Measurement, LogisticsEvent, LogisticsAction, Loading, DgDeclaration, TemperatureInstructions |
| 2-3 | Static config + mock data: `shc.json`, `stations.json`, `uld-specs.json`, `uld-inventory.json`, `flights.json`, `shipments.json`, `weather/DXB.json`, `airports/DXB.geojson`, `scenarios.json` (4 scenarios pre-baked) — all mock JSON in IATA shape |
| 3-4 | API routes: `/api/flights`, `/api/flights/[no]/shipments`, `/api/uld-inventory`, `/api/weather` (Open-Meteo proxy with mock fallback), `/api/dg/check` (stub forwarding shape until real API spec lands) |
| 4-5 | PCM physics engine (Euler integrator) + 5-stage state inference (turf geofence + sub-state classifier) + telemetry tick loop emitting `:Measurement[]` |
| 5-6 | Action recommender (action library + ranker + filters, no transit-specific) + Push-Time Scheduler (SHC + TemperatureInstructions lookup) |
| 6-7 | **Flight workspace + build-up canvas** (drag-drop AWB → ULD, DG check call, SHC compat, budget pre-flight, sign-off emitting `:Loading` + `:LogisticsEvent`) |
| 7-8 | Demo Control Panel + scenario runner + event dispatch table (incl. `auto_drag`, `dg_check_complete`, `build_up_signoff`) |
| 8-9 | ULD drill-down (`/uld/[uldId]`) with map + time-series chart + action card; tracking strip on flight workspace |
| 9-10 | Audit DB (Dexie) + excursion detector + resolution recorder + root-cause inferrer + deviation report builder |
| 10-11 | Supervisor surfaces — Live ULD Tracker dashboard + Excursion Log + Resolution Log + Audit Timeline views + LIVE/MOCK weather badge |
| 11-12 | Demo polish: scenario rehearsal, Web Notifications wiring, time-of-day theming, benefit-scatter chart |
| 12-13 | Pitch deck (5 slides: problem / gap / solution / live demo / ONE Record day-one), final deploy to Vercel |
| 13-15 | Rehearse all scenarios end-to-end, fix bugs, swap stub DG API for real hackathon-provided DG API once spec arrives |

**Stretch hours (if available)**:
- Real shipment data API integration (replace `/public/data/shipments.json` mock with carrier API call)
- OpenSky live flight position for DXB outbound (proxy via API route)
- Cryptographic hash of telemetry timeline for tamper-evident deviation reports
- ML-based delay prediction stub (precomputed lookup table per route+season)
- Animated airport map with ULD pin movement during state transitions
- "Export full audit bundle" one-click JSON-LD download per ULD (in ONE Record graph format)

## Mapping to Judging Criteria

| Criterion | How project scores |
|---|---|
| **Originality & Innovation** | First warehousing UI that bakes PCM digital-twin physics + SHC-driven push-time scheduler + station-aware action recommender directly into the build-up flow. Operator never leaves their primary workspace. Industry today shows manifests in one tool and cold-chain telemetry in another; we fuse them. **IATA ONE Record-native data model from day one** is a uniquely durable architectural bet — most demos are throwaway shapes. |
| **Technical Merit & Difficulty** | Real PCM ODE physics (Euler integrator), turf geofence + ambient-delta state classifier, multi-source data fusion (Open-Meteo weather + flight schedule + telemetry + station capability + SHC config + hackathon-provided DG check), full IATA ONE Record v3.2 type alignment with adapter pattern at API boundary. Drag-drop build-up flow with live DG validation. End-to-end working desktop app. All client-side TS + small Next.js API routes — no hidden backend complexity. |
| **Impact** | Cool-chain decisions happen where operator already lives — the warehousing workspace. Cheapest, highest-frequency mitigations (move-to-shade, cool-dolly retrieve) get put in operator hands with quantified benefit. SHC config operations-editable. **Audit logs (Excursion + Resolution + Per-ULD timeline) with IndexedDB persistence** deliver CEIV/GDP compliance evidence and auto-drafted deviation reports — cuts insurance disputes from 6 weeks to 6 minutes. **ONE Record native means adoption is plug-in, not migration**: any carrier or GHA running ONE Record can wire real APIs into our adapters in a sprint, not a quarter. |
| **Presentation Skills** | Live ticking demo from operator's desktop perspective: build a ULD → watch it leave warehouse → ambient ramps → predicted breach alert → one-click mitigation → audit timeline → ONE Record JSON-LD export. Visceral cause-and-effect end-to-end. Single-deploy Vercel URL means judges can poke at it themselves. |

## Critical Files to Create

```
hackathon/
├── PLAN.md                                  # this file
├── CLAUDE.md                                # project orchestration instructions
├── AGENTS.md                                # code conventions for Codex
├── resources/
│   └── IATA-1R-DM-Ontology.ttl              # ONE Record v3.2 reference
├── package.json
├── next.config.js
├── tailwind.config.ts
├── public/
│   ├── config/
│   │   ├── shc.json                         # SHC tolerance database (TemperatureInstructions + max-wait)
│   │   ├── stations.json                    # DXB capability registry
│   │   └── uld-specs.json                   # PCM specs per ULD product
│   └── data/
│       ├── weather/DXB.json
│       ├── airports/DXB.geojson
│       ├── flights.json                     # mock TransportMovement[]
│       ├── shipments.json                   # mock Waybill[] keyed by flightNumber
│       ├── uld-inventory.json               # mock ULD[]
│       └── scenarios.json
├── app/
│   ├── layout.tsx                           # root, Notification permission prompt
│   ├── page.tsx                             # ★ Today's outbound flights list
│   ├── flight/[flightNo]/page.tsx           # ★ Flight workspace (manifest + inventory + tracking)
│   ├── flight/[flightNo]/build/[uldId]/page.tsx  # ★ Build-up canvas
│   ├── uld/[uldId]/page.tsx                 # Per-ULD drill-down (map, charts, state)
│   ├── scan/page.tsx                        # mocked QR/barcode entry
│   ├── supervisor/page.tsx                  # Live ULD Tracker Dashboard
│   ├── supervisor/excursions/page.tsx       # Excursion Log
│   ├── supervisor/resolutions/page.tsx      # Resolution Log
│   ├── supervisor/audit/[uldId]/page.tsx    # Per-ULD Audit Timeline + deviation report
│   ├── admin/config/page.tsx                # SHC config viewer/editor
│   ├── dev/control/page.tsx                 # Demo Control Panel
│   ├── dev/inject/page.tsx                  # Manual injection
│   └── api/
│       ├── flights/route.ts
│       ├── flights/[flightNo]/shipments/route.ts
│       ├── uld-inventory/route.ts
│       ├── dg/check/route.ts
│       └── weather/route.ts
├── components/
│   ├── flight-card.tsx
│   ├── awb-manifest-panel.tsx
│   ├── uld-inventory-panel.tsx
│   ├── built-uld-strip.tsx
│   ├── build-up-canvas.tsx                  # ★ drag-drop UI
│   ├── dg-check-row.tsx
│   ├── shc-compat-row.tsx
│   ├── budget-preflight-row.tsx
│   ├── thermal-budget-bar.tsx
│   ├── shc-badge.tsx
│   ├── action-card.tsx
│   ├── uld-tracker-table.tsx
│   ├── airport-map.tsx                      # leaflet single-station DXB
│   ├── audit-timeline.tsx
│   ├── excursion-log-row.tsx
│   ├── resolution-log-row.tsx
│   ├── benefit-scatter-chart.tsx
│   ├── deviation-report-export.tsx
│   ├── weather-source-badge.tsx
│   └── push-time-card.tsx
└── lib/
    ├── ontology/
    │   └── one-record.ts                    # ★ IATA ONE Record v3.2 TS types
    ├── adapters/
    │   ├── flights.ts                       # mock JSON → TransportMovement[]
    │   ├── shipments.ts                     # mock JSON → Waybill[] (with Pieces + TemperatureInstructions)
    │   ├── uld-inventory.ts                 # mock JSON → ULD[]
    │   ├── dg-check.ts                      # request/response ↔ DgDeclaration
    │   └── weather.ts                       # Open-Meteo → ambient curve
    ├── physics/
    │   ├── pcm-model.ts
    │   └── uld-specs-loader.ts
    ├── inference/
    │   ├── state-classifier.ts              # 5-stage surface, sub-state internal
    │   └── airport-polygons-loader.ts
    ├── recommender/
    │   ├── action-library.ts
    │   ├── ranker.ts
    │   └── filters.ts
    ├── scheduler/
    │   ├── push-time.ts
    │   └── shc-loader.ts                    # SHC → TemperatureInstructions + max-wait
    ├── build-up/
    │   ├── dg-checker.ts                    # wraps POST /api/dg/check
    │   ├── shc-compat.ts                    # pure compat over TemperatureInstructions
    │   ├── budget-preflight.ts              # physics forecast hook
    │   └── sign-off.ts                      # emits Loading + LogisticsEvent
    ├── simulator/
    │   ├── tracker-feed.ts                  # in-browser tick loop emitting Measurement[]
    │   ├── scenario-runner.ts               # state machine + dispatch
    │   └── event-handlers/                  # one file per event type
    ├── stores/
    │   ├── flights-store.ts
    │   ├── uld-store.ts
    │   ├── inventory-store.ts
    │   ├── demo-clock-store.ts
    │   └── resources-store.ts
    ├── persistence/
    │   ├── local-prefs.ts
    │   └── audit-db.ts                      # Dexie storing IATA shapes
    ├── audit/
    │   ├── excursion-logger.ts              # emits LogisticsEvent (BREACH_PREDICTED, etc.)
    │   ├── resolution-logger.ts             # emits LogisticsAction
    │   ├── root-cause-inferrer.ts
    │   └── deviation-report-builder.ts      # Markdown/PDF
    └── notifications/
        └── web-notify.ts
```

## Verification (end-to-end)

1. Install + dev: `pnpm install && pnpm dev`
2. Open `localhost:3000`. Today's flight list renders, 3 outbound flights at DXB visible. 🟢 LIVE weather badge top-right.
3. Click a flight → workspace loads (manifest panel left, ULD inventory right, built-ULD strip bottom). Empty built strip.
4. Click `+ Build new ULD`, pick a ULD from inventory → build-up canvas. Drag a COL AWB; DG check fires (`POST /api/dg/check`); SHC compat row ticks; budget pre-flight row shows hours.
5. Add a second compatible AWB. Verify DG check fires per piece, both pass.
6. Try adding incompatible AWB (e.g., CRT 15-25°C with COL 2-8°C) — verify blocked with reason.
7. Sign off & seal → return to workspace, built ULD appears in tracking strip with `in-warehouse` state, 🟢 budget.
8. Open `/supervisor` second tab. Verify built ULD appears in tracker table with stage, internal °C, ambient °C, budget, outbound flight.
9. Open `/uld/[uldId]` from drill-down. Verify Leaflet DXB map renders, time-series chart renders, current state inference visible.
10. Open `/dev/control`. Verify scenario library displays 4 scenario cards.
11. Click PLAY on **DXB Warehouse Demo**. Verify scenario runner takes over: progress bar advances, events fire on schedule, UI auto-switches between flight workspace / build-up canvas / ULD detail / supervisor.
12. At ~1:00 scenario time: weather ramps, ULD transitions `in-warehouse` → `in-tarmac` via geofence event, physics recomputes.
13. At ~1:30: `BREACH_PREDICTED` fires. Web Notification + in-app alert. UI auto-focuses to ULD detail.
14. At "wait_for_user_action": click EXECUTE on action #2. Verify scenario resumes, budget recovers.
15. At ~2:40: scenario auto-focuses on `/supervisor/audit/[uldId]`. Verify timeline shows Loading event, state transitions, predicted breach event, executed action, deviation report Markdown preview.
16. At ~3:00: scenario ends. Click RESET — all state cleared.
17. **Replay test**: PLAY again. Identical run.
18. **DXB Quiet Shift**: PLAY → no alerts fire across full duration.
19. **DXB Cascading Delays**: PLAY → 3 delays fire, recommender prioritises across multiple at-risk ULDs.
20. **Custom Sandbox**: PLAY → no events fire automatically; manual `/dev/inject` panel works embedded.
21. **Open-Meteo fallback**: throttle network to offline, reload `/`. Within 3s, ⚪ MOCK badge appears, app continues to function.
22. **SHC config hot-reload**: pause active scenario, edit `public/config/shc.json` (tighten AVI ambient35c: 30 → 20), save, click "Reload SHC config" in `/admin/config`, resume scenario, scheduler picks up new threshold.
23. **Demo speed**: switch to 2× — scenario duration halves, logic stays correct.
24. **IATA shape verification**: open browser DevTools → Network → click any `/api/*` request, verify response JSON conforms to `:Waybill` / `:ULD` / `:TransportMovement` shape (has `@id`, `@type`, expected properties).
25. **DG check stub-to-real swap**: when hackathon DG API spec arrives, swap `/api/dg/check` adapter, verify build-up flow still passes/fails correctly.
26. **Audit DB persistence**: reload browser tab. Verify Excursion Log + Resolution Log + Audit Timeline entries survive reload (Dexie persistence working).
27. **Audit export**: open `/supervisor/audit/[uldId]`. Click "Export deviation report" → Markdown renders + downloads as `.md` file.
28. Visit live Vercel URL on a separate machine, run DXB Warehouse Demo end-to-end.
29. Pitch deck renders, full demo timing fits 3 min on rehearsal.

## Stretch Goals (post-MVP)

- Real shipment data API integration (replace `/public/data/shipments.json` with carrier API; new adapter only).
- IndexedDB telemetry persistence (24-hour `:Measurement[]` history per ULD).
- ML-based delay prediction using precomputed lookup table (route × season → delay distribution).
- Excursion Pre-Mortem: pre-flight risk score per `:Booking` (uses same physics + delay model).
- Liability Arbiter: post-incident chain-of-custody PDF export with cryptographic snapshot of telemetry timeline.
- JSON-LD export per ULD (full ONE Record graph format) — drop straight into a partner's ONE Record server.
- Animated airport map with ULD pin movement during state transitions.
- Multi-station support (re-introduces transit sub-states + multi-leg breakdown scenario).
