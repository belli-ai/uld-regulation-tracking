"use client";

import { create } from "zustand";

import stationsSource from "@/public/config/stations.json";
import flightsSource from "@/public/data/flights.json";
import scenariosSource from "@/public/data/scenarios.json";
import shipmentsSource from "@/public/data/shipments.json";
import uldInventorySource from "@/public/data/uld-inventory.json";
import { excursionLogger } from "@/lib/audit/excursion-logger";
import { adaptMockFlights } from "@/lib/adapters/flights";
import { adaptAllMockShipments } from "@/lib/adapters/shipments";
import {
  type IRI,
  toIRI,
  type Loading,
  type LogisticsEvent,
  type TemperatureInstructions,
  type TransportMovement,
  type Waybill,
} from "@/lib/ontology/one-record";
import { auditDb, type AuditDB } from "@/lib/persistence/audit-db";
import { useFlightsStore } from "@/lib/stores/flights-store";
import {
  useDemoClockStore,
  type DemoSpeedMultiplier,
} from "@/lib/stores/demo-clock-store";
import { useResourcesStore } from "@/lib/stores/resources-store";
import {
  scenarioSchema,
  scenariosFileSchema,
  type Scenario,
  type ScenarioEvent,
} from "@/lib/simulator/scenario-schema";
import { handleAlert } from "@/lib/simulator/event-handlers/alert";
import { handleAutoDrag } from "@/lib/simulator/event-handlers/auto-drag";
import { handleBuildUpSignoff } from "@/lib/simulator/event-handlers/build-up-signoff";
import { handleDgCheckComplete } from "@/lib/simulator/event-handlers/dg-check-complete";
import { handleFlightDelay } from "@/lib/simulator/event-handlers/flight-delay";
import { handleNotification } from "@/lib/simulator/event-handlers/notification";
import { handlePhysicsRecompute } from "@/lib/simulator/event-handlers/physics-recompute";
import { handleScenarioEnd } from "@/lib/simulator/event-handlers/scenario-end";
import { handleScenarioStart } from "@/lib/simulator/event-handlers/scenario-start";
import { handleTimeOfDayChange } from "@/lib/simulator/event-handlers/time-of-day-change";
import { handleUiFocus } from "@/lib/simulator/event-handlers/ui-focus";
import { handleUldActionComplete } from "@/lib/simulator/event-handlers/uld-action-complete";
import { handleUldStateForce } from "@/lib/simulator/event-handlers/uld-state-force";
import { handleWaitForUserAction } from "@/lib/simulator/event-handlers/wait-for-user-action";
import { handleWeatherOverride } from "@/lib/simulator/event-handlers/weather-override";
import { handleWeatherRamp } from "@/lib/simulator/event-handlers/weather-ramp";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type DemoFocusTarget =
  | "flight_list"
  | "flight_workspace"
  | "build_up_canvas"
  | "uld_detail"
  | "supervisor_dashboard"
  | "audit_log"
  | "pitch_slide";

type RunnerLogKind = "info" | "success" | "warning";
type EventStatus = "pending" | "dispatched";
type WeatherRampParam = "ambient_c" | "humidity_pct" | "cloud_cover_pct";

type InventoryUldRecord = {
  "@id": string;
  uldSerialNumber: string;
  uldProductCode?: string;
  iotDeviceId?: string;
  lastKnownInternalC?: number;
  lastKnownLocation?: string;
};

type DemoWeatherRamp = {
  endTickSec: number;
  from: number;
  overSec: number;
  param: WeatherRampParam;
  startTickSec: number;
  to: number;
};

export type DemoActionCard = {
  authorityLabel: string;
  benefitHours: number;
  ctaLabel: "EXECUTE" | "REQUEST" | "ESCALATE";
  etaMinutes: number;
  expectedActionToken: string;
  resourceHint?: string;
  title: string;
  tone: "positive" | "warning" | "destructive";
};

export type DemoUldRuntime = {
  actionCards: DemoActionCard[];
  assignedAwbs: string[];
  auditActionIds: string[];
  auditEventIds: string[];
  built: boolean;
  budgetHours: number;
  dgStatus: "idle" | "pass" | "fail" | "non-dg";
  flightNo: string | null;
  id: string;
  internalTemperatureC: number;
  iri: IRI;
  lastActionLabel: string | null;
  lastExcursionEventId: IRI | null;
  lastKnownLocation: string | null;
  predictedBreachMinutes: number | null;
  productCode: string;
  sealNumber: string | null;
  shc: string[];
  state:
    | "in-warehouse"
    | "in-tarmac"
    | "in-flight"
    | "arrived-tarmac"
    | "arrived-destination";
  trackerStreaming: boolean;
};

type DemoFlightRuntime = {
  arrivalLocation: IRI;
  delayMinutes: number;
  departureLocation: IRI;
  flightId: IRI;
  flightNumber: string;
  movementTimes: TransportMovement["movementTimes"];
};

export type RunnerTimelineItem = {
  event: ScenarioEvent;
  firedAtTickSec: number | null;
  id: string;
  index: number;
  status: EventStatus;
};

type RunnerLogEntry = {
  id: string;
  kind: RunnerLogKind;
  message: string;
  tickSec: number;
};

type WaitState = {
  expected: string;
  fallbackAfterSec: number;
  startedAtTickSec: number;
};

type InAppAlert = {
  body: string;
  title: string;
  tone: "info" | "warning" | "critical";
};

type BrowserNotificationState = {
  body: string;
  title: string;
  uldId: string | null;
};

type RunnerState = {
  activeScenarioId: string;
  browserNotification: BrowserNotificationState | null;
  currentScenarioDurationSec: number | null;
  flights: DemoFlightRuntime[];
  forceMockWeather: boolean;
  inAppAlert: InAppAlert | null;
  lastScenarioSummary: string | null;
  logs: RunnerLogEntry[];
  notificationsEnabled: boolean;
  scenarios: Scenario[];
  selectedFlightNo: string | null;
  selectedUldId: string | null;
  soundEnabled: boolean;
  statusMessage: string | null;
  timeOfDay: TimeOfDay;
  timeline: RunnerTimelineItem[];
  ulds: Record<string, DemoUldRuntime>;
  uiFocus: DemoFocusTarget;
  uiRoute: string;
  waitState: WaitState | null;
  weather: {
    ambientC: number;
    cloudCoverPct: number;
    humidityPct: number;
    ramp: DemoWeatherRamp | null;
  };
};

export type RunnerContext = {
  acknowledgeUserAction: (actionId: string) => boolean;
  addLog: (message: string, kind?: RunnerLogKind) => void;
  applyScenarioInitialState: (scenario: Scenario) => Promise<void>;
  auditDb: AuditDB;
  clearWaitState: () => void;
  currentScenario: Scenario;
  getFlight: (flightNo: string) => DemoFlightRuntime | null;
  getState: () => RunnerState;
  getUld: (uldId: string) => DemoUldRuntime | null;
  getWaybill: (awbNumber: string) => Waybill | null;
  nowIso: () => string;
  pauseClock: () => void;
  playClock: () => void;
  setInAppAlert: (alert: InAppAlert | null) => void;
  setState: (
    updater:
      | Partial<RunnerState>
      | ((state: RunnerState) => Partial<RunnerState> | void),
  ) => void;
  setWaitState: (waitState: WaitState | null) => void;
  startWaitTimer: (expected: string, fallbackAfterSec: number) => void;
  stores: {
    auditDb: AuditDB;
    demoClock: typeof useDemoClockStore;
    flights: typeof useFlightsStore;
    resources: typeof useResourcesStore;
    uldStore?: undefined;
  };
  updateUld: (
    uldId: string,
    updater: (uld: DemoUldRuntime) => DemoUldRuntime,
  ) => DemoUldRuntime | null;
};

type Handler = (
  event: ScenarioEvent,
  ctx: RunnerContext,
) => void | Promise<void>;

const parsedScenarioFile = scenariosFileSchema.parse(scenariosSource);
const SCENARIOS = parsedScenarioFile.scenarios.map((scenario) =>
  scenarioSchema.parse(scenario),
);
const FLIGHTS = adaptMockFlights(flightsSource);
const WAYBILLS_BY_FLIGHT = adaptAllMockShipments(shipmentsSource);
const INVENTORY = uldInventorySource as InventoryUldRecord[];
const STATION_CAPABILITIES = stationsSource as {
  DXB: {
    ceivCertified: boolean;
    iata: string;
    name: string;
    operatingHours: string;
    policies: {
      gpu?: string;
      shadingZones: string[];
      thermalBlanketStock: string;
      wetRagAuthorised: string;
    };
    resources: {
      buildupBaysTotal: number;
      breakdownBaysTotal?: number;
      coolDolliesTotal: number;
      coolRoomSlotsTotal?: number;
    };
  };
};

const DEFAULT_SCENARIO = SCENARIOS[0];
const DEFAULT_UI_FOCUS: DemoFocusTarget = "flight_list";
const BASE_TIME_MS = Date.parse("2026-04-25T10:00:00Z");

let clockInterval: number | null = null;
let waitFallbackTimer: number | null = null;
let advancing = false;

function routeForFocus(
  focus: DemoFocusTarget,
  selectedFlightNo: string | null,
  selectedUldId: string | null,
): string {
  switch (focus) {
    case "flight_list":
      return "/";
    case "flight_workspace":
      return selectedFlightNo ? `/flight/${selectedFlightNo}` : "/flight/[flightNo]";
    case "build_up_canvas":
      return selectedFlightNo && selectedUldId
        ? `/flight/${selectedFlightNo}/build/${selectedUldId}`
        : "/flight/[flightNo]/build/[uldId]";
    case "uld_detail":
      return selectedUldId ? `/uld/${selectedUldId}` : "/uld/[uldId]";
    case "supervisor_dashboard":
      return "/supervisor";
    case "audit_log":
      return selectedUldId
        ? `/supervisor/audit/${selectedUldId}`
        : "/supervisor/audit/[uldId]";
    case "pitch_slide":
      return "/pitch";
  }
}

function timelineForScenario(scenario: Scenario): RunnerTimelineItem[] {
  return (scenario.events ?? []).map((event, index) => ({
    event,
    firedAtTickSec: null,
    id: `${scenario.id}:${index}:${event.type}:${event.at_s}`,
    index,
    status: "pending",
  }));
}

function floorNumber(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function weatherBaseForTimeOfDay(timeOfDay: TimeOfDay): {
  ambientC: number;
  cloudCoverPct: number;
  humidityPct: number;
} {
  switch (timeOfDay) {
    case "morning":
      return { ambientC: 31, humidityPct: 58, cloudCoverPct: 25 };
    case "afternoon":
      return { ambientC: 38, humidityPct: 60, cloudCoverPct: 30 };
    case "evening":
      return { ambientC: 29, humidityPct: 56, cloudCoverPct: 40 };
    case "night":
      return { ambientC: 24, humidityPct: 63, cloudCoverPct: 15 };
  }
}

function currentScenarioById(scenarioId: string): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? DEFAULT_SCENARIO;
}

function awbNumber(waybill: Waybill): string {
  return `${waybill.waybillPrefix}-${waybill.waybillNumber}`;
}

function findInventoryRecord(uldId: string): InventoryUldRecord | null {
  return (
    INVENTORY.find((record) => record.uldSerialNumber === uldId) ??
    INVENTORY.find((record) => record["@id"] === uldId) ??
    null
  );
}

function selectedFlightsForScenario(scenario: Scenario): DemoFlightRuntime[] {
  const allowed = scenario.initial_state?.flights;
  const relevantFlights =
    Array.isArray(allowed) && allowed.length > 0
      ? FLIGHTS.filter((flight) => allowed.includes(flight.flightNumber))
      : FLIGHTS;

  return relevantFlights.map((flight) => ({
    arrivalLocation: flight.arrivalLocation,
    delayMinutes: 0,
    departureLocation: flight.departureLocation,
    flightId: flight["@id"],
    flightNumber: flight.flightNumber,
    movementTimes: flight.movementTimes,
  }));
}

function selectedWaybillsForScenario(
  scenario: Scenario,
): Record<string, Waybill[]> {
  const flightNumbers = new Set(
    selectedFlightsForScenario(scenario).map((flight) => flight.flightNumber),
  );
  const filtered: Record<string, Waybill[]> = {};

  for (const [flightNo, waybills] of Object.entries(WAYBILLS_BY_FLIGHT)) {
    if (!flightNumbers.has(flightNo)) {
      continue;
    }
    filtered[flightNo] = waybills;
  }

  return filtered;
}

function shcForUld(assignedAwbs: string[]): string[] {
  const shc = new Set<string>();

  for (const awb of assignedAwbs) {
    const waybill = findWaybill(awb);
    if (waybill) {
      shc.add(waybill.shc);
    }
  }

  return [...shc];
}

function scenarioUlds(scenario: Scenario): Record<string, DemoUldRuntime> {
  const allowed = scenario.initial_state?.ulds;
  const relevantInventory =
    Array.isArray(allowed) && allowed.length > 0
      ? INVENTORY.filter((record) => allowed.includes(record.uldSerialNumber))
      : INVENTORY;

  return relevantInventory.reduce<Record<string, DemoUldRuntime>>((acc, record) => {
    const initialInternalC =
      typeof record.lastKnownInternalC === "number" ? record.lastKnownInternalC : 6;
    acc[record.uldSerialNumber] = {
      actionCards: [],
      assignedAwbs: [],
      auditActionIds: [],
      auditEventIds: [],
      built: false,
      budgetHours: 11.2,
      dgStatus: "idle",
      flightNo: null,
      id: record.uldSerialNumber,
      internalTemperatureC: initialInternalC,
      iri: toIRI(record["@id"]),
      lastActionLabel: null,
      lastExcursionEventId: null,
      lastKnownLocation: record.lastKnownLocation ?? null,
      predictedBreachMinutes: null,
      productCode: record.uldProductCode ?? "GENERIC_PASSIVE",
      sealNumber: null,
      shc: [],
      state: "in-warehouse",
      trackerStreaming: false,
    };
    return acc;
  }, {});
}

function initialRunnerState(scenario: Scenario): RunnerState {
  const initialTimeOfDay = scenario.initial_state?.time_of_day ?? "afternoon";
  const weatherBase = weatherBaseForTimeOfDay(initialTimeOfDay);
  const weatherOverride = scenario.initial_state?.weather_override;
  const firstFlight = scenario.initial_state?.flights?.[0] ?? null;
  const firstUld = scenario.initial_state?.ulds?.[0] ?? null;

  return {
    activeScenarioId: scenario.id,
    browserNotification: null,
    currentScenarioDurationSec: scenario.duration_seconds,
    flights: selectedFlightsForScenario(scenario),
    forceMockWeather: true,
    inAppAlert: null,
    lastScenarioSummary: null,
    logs: [],
    notificationsEnabled: true,
    scenarios: SCENARIOS,
    selectedFlightNo: firstFlight,
    selectedUldId: firstUld,
    soundEnabled: true,
    statusMessage: null,
    timeOfDay: initialTimeOfDay,
    timeline: timelineForScenario(scenario),
    ulds: scenarioUlds(scenario),
    uiFocus: DEFAULT_UI_FOCUS,
    uiRoute: routeForFocus(DEFAULT_UI_FOCUS, firstFlight, firstUld),
    waitState: null,
    weather: {
      ambientC: weatherOverride?.ambient_c ?? weatherBase.ambientC,
      cloudCoverPct: weatherOverride?.cloud_cover_pct ?? weatherBase.cloudCoverPct,
      humidityPct: weatherOverride?.humidity_pct ?? weatherBase.humidityPct,
      ramp: null,
    },
  };
}

export const useScenarioRunnerStore = create<RunnerState>()(() =>
  initialRunnerState(DEFAULT_SCENARIO),
);

function setRunnerState(
  updater:
    | Partial<RunnerState>
    | ((state: RunnerState) => Partial<RunnerState> | void),
): void {
  useScenarioRunnerStore.setState((state) => {
    if (typeof updater !== "function") {
      return updater;
    }
    return updater(state) ?? {};
  });
}

function findWaybill(awbNumberToFind: string): Waybill | null {
  for (const waybills of Object.values(WAYBILLS_BY_FLIGHT)) {
    const match = waybills.find((waybill) => awbNumber(waybill) === awbNumberToFind);
    if (match) {
      return match;
    }
  }
  return null;
}

function currentTickSec(): number {
  return useDemoClockStore.getState().currentTickSec;
}

function nowIso(): string {
  return new Date(BASE_TIME_MS + currentTickSec() * 1000).toISOString();
}

function addLog(message: string, kind: RunnerLogKind = "info"): void {
  setRunnerState((state) => ({
    logs: [
      {
        id: `${Date.now()}:${state.logs.length}`,
        kind,
        message,
        tickSec: useDemoClockStore.getState().currentTickSec,
      },
      ...state.logs,
    ].slice(0, 40),
  }));
}

function clearClockInterval(): void {
  if (clockInterval !== null) {
    window.clearInterval(clockInterval);
    clockInterval = null;
  }
}

function clearWaitTimer(): void {
  if (waitFallbackTimer !== null) {
    window.clearTimeout(waitFallbackTimer);
    waitFallbackTimer = null;
  }
}

async function clearAuditDb(): Promise<void> {
  await auditDb.events.clear();
  await auditDb.actions.clear();
  await auditDb.loadings.clear();
}

async function applyScenarioInitialState(scenario: Scenario): Promise<void> {
  const state = initialRunnerState(scenario);
  useDemoClockStore.getState().reset();
  useResourcesStore.getState().setResources({
    freeBuildupBays: floorNumber(scenario.initial_state?.resources?.buildup_bays_free),
    freeCoolDollies: floorNumber(scenario.initial_state?.resources?.cool_dollies_free),
    freeCoolRoomSlots: floorNumber(
      scenario.initial_state?.resources?.cool_room_slots_free,
    ),
  });
  await clearAuditDb();
  setRunnerState(state);
}

function updateUld(
  uldId: string,
  updater: (uld: DemoUldRuntime) => DemoUldRuntime,
): DemoUldRuntime | null {
  const current = useScenarioRunnerStore.getState().ulds[uldId];
  if (!current) {
    return null;
  }

  const next = updater(current);
  setRunnerState((state) => ({
    selectedUldId: state.selectedUldId ?? uldId,
    ulds: {
      ...state.ulds,
      [uldId]: next,
    },
  }));

  return next;
}

function getUld(uldId: string): DemoUldRuntime | null {
  return useScenarioRunnerStore.getState().ulds[uldId] ?? null;
}

function getFlight(flightNo: string): DemoFlightRuntime | null {
  return (
    useScenarioRunnerStore.getState().flights.find(
      (flight) => flight.flightNumber === flightNo,
    ) ?? null
  );
}

function setWaitState(waitState: WaitState | null): void {
  setRunnerState({ waitState });
}

function clearWaitState(): void {
  clearWaitTimer();
  setWaitState(null);
}

function startWaitTimer(expected: string, fallbackAfterSec: number): void {
  const startedAtTickSec = currentTickSec();
  clearWaitTimer();
  useDemoClockStore.getState().pause();
  setWaitState({
    expected,
    fallbackAfterSec,
    startedAtTickSec,
  });

  waitFallbackTimer = window.setTimeout(() => {
    addLog(`Fallback timer elapsed for ${expected}; resuming scenario`, "warning");
    setWaitState(null);
    useDemoClockStore.getState().play();
    ensureTickLoop();
  }, fallbackAfterSec * 1000);
}

function setInAppAlert(alert: InAppAlert | null): void {
  setRunnerState({ inAppAlert: alert });
}

function acknowledgeUserAction(actionId: string): boolean {
  const state = useScenarioRunnerStore.getState();
  if (state.waitState?.expected !== actionId) {
    return false;
  }

  addLog(`Expected interaction completed: ${actionId}`, "success");
  clearWaitState();
  useDemoClockStore.getState().play();
  ensureTickLoop();
  return true;
}

function runnerContextForScenario(scenario: Scenario): RunnerContext {
  return {
    acknowledgeUserAction,
    addLog,
    applyScenarioInitialState,
    auditDb,
    clearWaitState,
    currentScenario: scenario,
    getFlight,
    getState: useScenarioRunnerStore.getState,
    getUld,
    getWaybill: findWaybill,
    nowIso,
    pauseClock: () => useDemoClockStore.getState().pause(),
    playClock: () => {
      useDemoClockStore.getState().play();
      ensureTickLoop();
    },
    setInAppAlert,
    setState: setRunnerState,
    setWaitState,
    startWaitTimer,
    stores: {
      auditDb,
      demoClock: useDemoClockStore,
      flights: useFlightsStore,
      resources: useResourcesStore,
      uldStore: undefined,
    },
    updateUld,
  };
}

const handlers: Record<string, Handler> = {
  alert: handleAlert,
  auto_drag: handleAutoDrag,
  build_up_signoff: handleBuildUpSignoff,
  dg_check_complete: handleDgCheckComplete,
  flight_delay: handleFlightDelay,
  notification: handleNotification,
  physics_recompute: handlePhysicsRecompute,
  scenario_end: handleScenarioEnd,
  scenario_start: handleScenarioStart,
  time_of_day_change: handleTimeOfDayChange,
  ui_focus: handleUiFocus,
  uld_action_complete: handleUldActionComplete,
  uld_state_force: handleUldStateForce,
  wait_for_user_action: handleWaitForUserAction,
  weather_override: handleWeatherOverride,
  weather_ramp: handleWeatherRamp,
};

function applyWeatherRampForTick(tickSec: number): void {
  const currentRamp = useScenarioRunnerStore.getState().weather.ramp;
  if (!currentRamp) {
    return;
  }

  const elapsed = Math.max(0, tickSec - currentRamp.startTickSec);
  const progress = Math.min(1, elapsed / currentRamp.overSec);
  const value =
    currentRamp.from + (currentRamp.to - currentRamp.from) * progress;

  setRunnerState((state) => {
    const nextWeather = {
      ...state.weather,
      ramp: progress >= 1 ? null : currentRamp,
    };

    if (currentRamp.param === "ambient_c") {
      nextWeather.ambientC = Number(value.toFixed(1));
    }
    if (currentRamp.param === "humidity_pct") {
      nextWeather.humidityPct = Number(value.toFixed(0));
    }
    if (currentRamp.param === "cloud_cover_pct") {
      nextWeather.cloudCoverPct = Number(value.toFixed(0));
    }

    return { weather: nextWeather };
  });
}

async function dispatchScenarioEvent(item: RunnerTimelineItem): Promise<void> {
  const state = useScenarioRunnerStore.getState();
  const scenario = currentScenarioById(state.activeScenarioId);
  const handler = handlers[item.event.type];

  if (!handler) {
    addLog(`No handler registered for event type "${item.event.type}"`, "warning");
    setRunnerState((current) => ({
      timeline: current.timeline.map((timelineItem) =>
        timelineItem.id === item.id
          ? {
              ...timelineItem,
              firedAtTickSec: currentTickSec(),
              status: "dispatched",
            }
          : timelineItem,
      ),
    }));
    return;
  }

  await handler(item.event, runnerContextForScenario(scenario));

  setRunnerState((current) => ({
    timeline: current.timeline.map((timelineItem) =>
      timelineItem.id === item.id
        ? {
            ...timelineItem,
            firedAtTickSec: currentTickSec(),
            status: "dispatched",
          }
        : timelineItem,
    ),
  }));
}

async function dispatchEventsForTick(tickSec: number): Promise<void> {
  const dueEvents = useScenarioRunnerStore
    .getState()
    .timeline.filter(
      (item) => item.status === "pending" && item.event.at_s === tickSec,
    )
    .sort((left, right) => left.index - right.index);

  for (const item of dueEvents) {
    await dispatchScenarioEvent(item);
    if (useDemoClockStore.getState().playState === "paused") {
      break;
    }
  }
}

async function dispatchTickZeroIfNeeded(): Promise<void> {
  const hasPendingTickZero = useScenarioRunnerStore
    .getState()
    .timeline.some((item) => item.status === "pending" && item.event.at_s === 0);

  if (hasPendingTickZero) {
    await dispatchEventsForTick(0);
  }
}

async function advanceClockBy(deltaSec: number): Promise<void> {
  if (advancing) {
    return;
  }

  advancing = true;

  try {
    for (let step = 0; step < deltaSec; step += 1) {
      if (useDemoClockStore.getState().playState !== "playing") {
        break;
      }

      const nextTick = currentTickSec() + 1;
      useDemoClockStore.getState().setCurrentTickSec(nextTick);
      applyWeatherRampForTick(nextTick);
      await dispatchEventsForTick(nextTick);

      if (
        useScenarioRunnerStore.getState().currentScenarioDurationSec !== null &&
        nextTick >=
          (useScenarioRunnerStore.getState().currentScenarioDurationSec ?? Number.MAX_SAFE_INTEGER)
      ) {
        const endEventPending = useScenarioRunnerStore
          .getState()
          .timeline.some(
            (item) =>
              item.status === "pending" &&
              item.event.type === "scenario_end" &&
              item.event.at_s === nextTick,
          );

        if (!endEventPending) {
          useDemoClockStore.getState().pause();
          break;
        }
      }
    }
  } finally {
    advancing = false;
  }
}

function ensureTickLoop(): void {
  if (typeof window === "undefined") {
    return;
  }

  clearClockInterval();

  if (useDemoClockStore.getState().playState !== "playing") {
    return;
  }

  clockInterval = window.setInterval(() => {
    const speedMultiplier = useDemoClockStore.getState().speedMultiplier;
    void advanceClockBy(speedMultiplier);
  }, 1000);
}

export const demoScenarioRunner = {
  async acknowledgeUserAction(actionId: string) {
    return acknowledgeUserAction(actionId);
  },
  getScenarioById(scenarioId: string) {
    return currentScenarioById(scenarioId);
  },
  async injectEvent(event: ScenarioEvent) {
    const scenario = currentScenarioById(useScenarioRunnerStore.getState().activeScenarioId);
    const handler = handlers[event.type];
    if (!handler) {
      addLog(`Cannot inject unsupported event "${event.type}"`, "warning");
      return;
    }

    await handler(event, runnerContextForScenario(scenario));
  },
  async pause() {
    useDemoClockStore.getState().pause();
    clearClockInterval();
  },
  async play() {
    await dispatchTickZeroIfNeeded();
    useDemoClockStore.getState().play();
    ensureTickLoop();
  },
  async reset() {
    clearClockInterval();
    clearWaitTimer();
    await applyScenarioInitialState(
      currentScenarioById(useScenarioRunnerStore.getState().activeScenarioId),
    );
  },
  async selectScenario(scenarioId: string) {
    clearClockInterval();
    clearWaitTimer();
    await applyScenarioInitialState(currentScenarioById(scenarioId));
  },
  setForceMockWeather(forceMockWeather: boolean) {
    setRunnerState({ forceMockWeather });
  },
  setNotificationsEnabled(notificationsEnabled: boolean) {
    setRunnerState({ notificationsEnabled });
  },
  setSoundEnabled(soundEnabled: boolean) {
    setRunnerState({ soundEnabled });
  },
  setSpeedMultiplier(speedMultiplier: DemoSpeedMultiplier) {
    useDemoClockStore.getState().setSpeedMultiplier(speedMultiplier);
    ensureTickLoop();
  },
  setTimeOfDay(timeOfDay: TimeOfDay) {
    const ambient = weatherBaseForTimeOfDay(timeOfDay);
    setRunnerState((state) => ({
      timeOfDay,
      weather: {
        ambientC: ambient.ambientC,
        cloudCoverPct: state.weather.cloudCoverPct,
        humidityPct: state.weather.humidityPct,
        ramp: null,
      },
    }));
  },
  async skip(deltaSec: number) {
    if (deltaSec <= 0) {
      return;
    }

    const wasPlaying = useDemoClockStore.getState().playState === "playing";
    if (!wasPlaying) {
      useDemoClockStore.getState().play();
    }
    await advanceClockBy(deltaSec);
    if (!wasPlaying) {
      useDemoClockStore.getState().pause();
    }
  },
};

export function getScenarioWaybills(flightNo: string): Waybill[] {
  return selectedWaybillsForScenario(
    currentScenarioById(useScenarioRunnerStore.getState().activeScenarioId),
  )[flightNo] ?? [];
}

export function buildTemperatureInstructionForAwbs(
  awbs: string[],
): TemperatureInstructions {
  const allInstructions = awbs
    .map((awb) => findWaybill(awb))
    .filter((waybill): waybill is Waybill => waybill !== null)
    .flatMap((waybill) =>
      waybill.pieces
        .map((piece) => {
          const candidate = piece as typeof piece & {
            temperatureInstructions?: TemperatureInstructions;
          };
          return candidate.temperatureInstructions;
        })
        .filter(
          (instructions): instructions is TemperatureInstructions =>
            instructions !== undefined,
        ),
    );

  const minTemperature = Math.min(
    ...allInstructions.map((instructions) => instructions.minTemperature.value),
    2,
  );
  const maxTemperature = Math.max(
    ...allInstructions.map((instructions) => instructions.maxTemperature.value),
    8,
  );

  return {
    "@id": toIRI(`urn:cool-chain:temp:${awbs.join("+") || "default"}`),
    "@type": "TemperatureInstructions",
    maxTemperature: { unit: "C", value: maxTemperature },
    minTemperature: { unit: "C", value: minTemperature },
  };
}

export function buildExcursionEventForUld(
  uld: DemoUldRuntime,
  observedAt: string,
): LogisticsEvent | null {
  return excursionLogger.detect(
    {
      ambientTemperatureC: useScenarioRunnerStore.getState().weather.ambientC,
      internalTemperatureC: uld.internalTemperatureC,
      locationId: toIRI(uld.lastKnownLocation ?? "urn:cargo:zone:DXB-unknown"),
      observedAt,
      predictedBreachInMinutes: uld.predictedBreachMinutes,
      state: uld.state,
      thermalBudgetRemainingPercent: Math.max(0, Math.min(100, uld.budgetHours * 8)),
      uldId: uld.iri,
    },
    {
      breachPredictionWindowMinutes: 45,
      maxInternalTemperatureC: 8,
      warningBudgetPercent: 40,
    },
  );
}

export function createLoadingRecord(
  uld: DemoUldRuntime,
  observedAt: string,
): Loading {
  const loadedPieceIds = uld.assignedAwbs
    .map((awb) => findWaybill(awb))
    .filter((waybill): waybill is Waybill => waybill !== null)
    .flatMap((waybill) => waybill.pieces.map((piece) => piece["@id"]));

  return {
    "@id": toIRI(
      `urn:cool-chain:loading:${uld.id}:${encodeURIComponent(observedAt)}`,
    ),
    "@type": "Loading",
    actionEndTime: observedAt,
    actionStartTime: observedAt,
    loadedPieces: loadedPieceIds,
    loadedUnits: [uld.iri],
    loadingType: "build-up",
    performedAt: toIRI(uld.lastKnownLocation ?? "urn:cargo:zone:DXB-build-up-area"),
  };
}

export function getStationCapabilities() {
  return STATION_CAPABILITIES.DXB;
}
