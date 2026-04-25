"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { PackagePlus, Wand2 } from "lucide-react";
import uldSpecsData from "@/public/config/uld-specs.json";
import { AwbManifestPanel } from "@/components/awb-manifest-panel";
import {
  BuiltUldStrip,
  type BuiltUldStripEntry,
} from "@/components/built-uld-strip";
import {
  MetricTile,
  MissionShell,
  MissionTopBar,
  StatusRail,
} from "@/components/mission-control";
import { UldPickerSheet } from "@/components/uld-picker-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  autoBuildFlight,
  type AutoBuildUldSpec,
} from "@/lib/build-up/auto-build";
import { signOff } from "@/lib/build-up/sign-off";
import {
  publishLoading,
  publishLogisticsEvent,
} from "@/lib/adapters/one-connect/publish-client";
import type {
  LogisticsEvent,
  ULD,
  TransportMovement,
  Waybill,
} from "@/lib/ontology/one-record";
import {
  useInventoryStore,
  type InventoryUld,
} from "@/lib/stores/inventory-store";
import { useUldStore } from "@/lib/stores/uld-store";
import { auditDb } from "@/lib/persistence/audit-db";
import { cn } from "@/lib/utils";

declare module "react" {
  interface Attributes {
    indicatorClassName?: string;
  }
}

const uldSpecs = uldSpecsData as Record<string, AutoBuildUldSpec>;

type FlightUldState =
  | "warehouse"
  | "tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";

type MonitorStage =
  | "in-warehouse"
  | "in-tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";

const LOGICAL_MULTIPLIER = 1200;
const STAGE_BY_EVENT: Partial<Record<string, MonitorStage>> = {
  BUILD_UP_COMPLETE: "in-warehouse",
  STATE_DEST_WAREHOUSE_IN: "arrived-destination",
  STATE_FLIGHT_IN: "in-flight",
  STATE_TARMAC_DEST_IN: "arrived-tarmac",
  STATE_TARMAC_IN: "in-tarmac",
  STATE_WAREHOUSE_IN: "in-warehouse",
};
const BASE_BUDGET_HOURS: Record<FlightUldState, number> = {
  "arrived-destination": 8,
  "arrived-tarmac": 3,
  "in-flight": 9,
  tarmac: 4,
  warehouse: 11.2,
};

type ApiDataResponse<T> = {
  data: T;
};

function formatFlightTime(flight: TransportMovement | null) {
  const std = flight?.movementTimes.find((time) => time.type === "STD");
  if (!std?.timestamp) {
    return "TBD";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(std.timestamp));
}

function formatLocation(iri: string | undefined) {
  if (!iri) {
    return "TBD";
  }
  return iri.split(":").at(-1) ?? iri;
}

function buildWorkspaceEntries(
  ulds: ULD[],
  contents: Record<string, Waybill[]>,
  stageByUld: Record<string, MonitorStage>,
  events: LogisticsEvent[],
  logicalNowMs: number,
): BuiltUldStripEntry[] {
  return ulds.flatMap((uld) => {
    const waybills = contents[uld["@id"]] ?? [];
    if (waybills.length === 0) {
      return [];
    }

    const shcCodes = Array.from(
      new Set(waybills.map((waybill) => waybill.shc).filter(Boolean)),
    );
    const currentState = getCurrentState(uld, stageByUld, events);
    const liveBudget = getLiveBudget(uld, currentState, events, logicalNowMs);

    return [
      {
        uld,
        awbCount: waybills.length,
        budgetH: liveBudget.hours,
        budgetTone: liveBudget.tone,
        currentState,
        shc:
          shcCodes.length === 1
            ? shcCodes[0]
            : shcCodes.length > 1
              ? "MIX"
              : "TBD",
        thermalBudgetLabel: `${liveBudget.hours.toFixed(1)}h`,
      },
    ];
  });
}

function getMonitorStorageKey(flightNo: string): string {
  return `cool-chain:flight-monitor:${flightNo}`;
}

function isMonitorStage(value: unknown): value is MonitorStage {
  return typeof value === "string" && value in BASE_BUDGET_HOURS_BY_MONITOR;
}

const BASE_BUDGET_HOURS_BY_MONITOR: Record<MonitorStage, number> = {
  "arrived-destination": BASE_BUDGET_HOURS["arrived-destination"],
  "arrived-tarmac": BASE_BUDGET_HOURS["arrived-tarmac"],
  "in-flight": BASE_BUDGET_HOURS["in-flight"],
  "in-tarmac": BASE_BUDGET_HOURS.tarmac,
  "in-warehouse": BASE_BUDGET_HOURS.warehouse,
};

function readMonitorStages(flightNo: string): Record<string, MonitorStage> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(getMonitorStorageKey(flightNo));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object") {
      return {};
    }

    const stages: Record<string, MonitorStage> = {};
    for (const [uldSerialNumber, stage] of Object.entries(parsed)) {
      if (isMonitorStage(stage)) {
        stages[uldSerialNumber] = stage;
      }
    }
    return stages;
  } catch (storageError) {
    console.error("Failed to read flight monitor stages", storageError);
    return {};
  }
}

function asUldSerial(value: string): string {
  return value.split(":").at(-1) ?? value;
}

function getLatestStageEvent(
  uld: ULD,
  events: LogisticsEvent[],
): LogisticsEvent | null {
  return (
    events
      .filter(
        (event) =>
          asUldSerial(String(event.eventFor)) === uld.uldSerialNumber &&
          STAGE_BY_EVENT[event.eventCode],
      )
      .sort(
        (left, right) =>
          Date.parse(right.eventDate) - Date.parse(left.eventDate),
      )[0] ?? null
  );
}

function toCurrentState(stage: MonitorStage): FlightUldState {
  if (stage === "in-warehouse") {
    return "warehouse";
  }

  if (stage === "in-tarmac") {
    return "tarmac";
  }

  return stage;
}

function getCurrentState(
  uld: ULD,
  stageByUld: Record<string, MonitorStage>,
  events: LogisticsEvent[],
): FlightUldState {
  const storedStage = stageByUld[uld.uldSerialNumber];
  if (storedStage) {
    return toCurrentState(storedStage);
  }

  const latestEvent = getLatestStageEvent(uld, events);
  return latestEvent
    ? toCurrentState(STAGE_BY_EVENT[latestEvent.eventCode] ?? "in-warehouse")
    : "warehouse";
}

function getTarmacStartedMs(uld: ULD, events: LogisticsEvent[]): number | null {
  const event = events
    .filter(
      (candidate) =>
        asUldSerial(String(candidate.eventFor)) === uld.uldSerialNumber &&
        candidate.eventCode === "STATE_TARMAC_IN",
    )
    .sort(
      (left, right) => Date.parse(right.eventDate) - Date.parse(left.eventDate),
    )[0];
  if (!event) {
    return null;
  }

  const parsed = Date.parse(event.eventDate);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBudgetTone(hours: number): "green" | "yellow" | "red" {
  if (hours > 6) {
    return "green";
  }

  if (hours >= 2) {
    return "yellow";
  }

  return "red";
}

function getLiveBudget(
  uld: ULD,
  state: FlightUldState,
  events: LogisticsEvent[],
  logicalNowMs: number,
): { hours: number; tone: "green" | "yellow" | "red" } {
  let hours = BASE_BUDGET_HOURS[state];

  if (state === "tarmac") {
    const tarmacStartedMs = getTarmacStartedMs(uld, events);
    if (tarmacStartedMs !== null) {
      const elapsedHours = Math.max(
        0,
        (logicalNowMs - tarmacStartedMs) / 3_600_000,
      );
      hours = Math.max(0, hours - elapsedHours);
    }
  }

  return {
    hours,
    tone: getBudgetTone(hours),
  };
}

function buildAssignedUldMap(
  ulds: ULD[],
  contents: Record<string, Waybill[]>,
): Record<string, string> {
  const uldsById = new Map(
    ulds.map((uld) => [String(uld["@id"]), uld.uldSerialNumber]),
  );
  const entries: Array<[string, string]> = [];

  for (const [uldId, waybills] of Object.entries(contents)) {
    const uldSerialNumber = uldsById.get(uldId);
    if (!uldSerialNumber) {
      continue;
    }

    for (const waybill of waybills) {
      entries.push([waybill["@id"], uldSerialNumber]);
    }
  }

  return Object.fromEntries(entries);
}

function isEligibleInventoryUld(uld: InventoryUld) {
  return uld.serviceabilityCode === "SER" && !uld.damageFlag;
}

function getShipmentMix(shipments: Waybill[]): string {
  const shcCodes = Array.from(
    new Set(shipments.map((shipment) => shipment.shc).filter(Boolean)),
  ).sort();

  if (shcCodes.length === 0) {
    return "No SHC";
  }

  return shcCodes.join(" / ");
}

async function readApiData<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const body = (await response.json()) as ApiDataResponse<T>;
  return body.data;
}

export default function FlightWorkspacePage() {
  const params = useParams<{ flightNo: string }>();
  const router = useRouter();
  const flightNo = typeof params.flightNo === "string" ? params.flightNo : "";

  const inventory = useInventoryStore((state) => state.inventory);
  const hydrateInventory = useInventoryStore((state) => state.hydrateInventory);
  const markInBuildUp = useInventoryStore((state) => state.markInBuildUp);
  const releaseFromBuildUp = useInventoryStore(
    (state) => state.releaseFromBuildUp,
  );
  const builtUlds = useUldStore((state) => state.ulds);
  const builtContents = useUldStore((state) => state.contents);
  const addBuiltUld = useUldStore((state) => state.addBuiltUld);

  const [flight, setFlight] = useState<TransportMovement | null>(null);
  const [shipments, setShipments] = useState<Waybill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [autoBuildMessage, setAutoBuildMessage] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<LogisticsEvent[]>([]);
  const [monitorStages, setMonitorStages] = useState<
    Record<string, MonitorStage>
  >({});
  const [clockAnchor] = useState(() => ({
    baseMs: Date.now(),
    startedAtMs: Date.now(),
  }));
  const [logicalNowMs, setLogicalNowMs] = useState(clockAnchor.baseMs);

  useEffect(() => {
    let isCancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      setError(null);

      try {
        const [flightsData, shipmentsData, inventoryData] = await Promise.all([
          readApiData<TransportMovement[]>("/api/flights"),
          readApiData<Waybill[]>(
            `/api/flights/${encodeURIComponent(flightNo)}/shipments`,
          ),
          readApiData<ULD[]>("/api/uld-inventory"),
        ]);

        if (isCancelled) {
          return;
        }

        const [events, loadings] = await Promise.all([
          auditDb.events.toArray().catch(() => []),
          auditDb.loadings.toArray().catch(() => []),
        ]);
        if (isCancelled) {
          return;
        }

        startTransition(() => {
          setFlight(
            flightsData.find(
              (candidate) => candidate.flightNumber === flightNo,
            ) ?? null,
          );
          setShipments(shipmentsData);
          hydrateInventory(inventoryData);
          setAuditEvents(events);
          setMonitorStages(readMonitorStages(flightNo));

          const inventoryById = new Map(
            inventoryData.map((u) => [u["@id"], u]),
          );
          const shipmentsById = new Map(
            shipmentsData.map((s) => [s["@id"], s]),
          );
          for (const loading of loadings) {
            const uldIri = loading.loadedUnits?.[0];
            if (!uldIri) continue;
            const uld = inventoryById.get(uldIri);
            if (!uld) continue;
            const waybillIds: Waybill["@id"][] = [];
            const seen = new Set<string>();
            for (const piece of loading.loadedPieces ?? []) {
              const shipment = shipmentsData.find((s) =>
                s.pieces?.some((p) => p["@id"] === piece),
              );
              if (!shipment) continue;
              if (seen.has(shipment["@id"])) continue;
              seen.add(shipment["@id"]);
              waybillIds.push(shipment["@id"]);
            }
            const contents: Waybill[] = [];
            for (const id of waybillIds) {
              const wb = shipmentsById.get(id);
              if (wb) contents.push(wb);
            }
            addBuiltUld(uld, contents);
          }

          setIsLoading(false);
        });
      } catch (loadError) {
        console.error("Flight workspace load failed", loadError);
        if (isCancelled) {
          return;
        }

        startTransition(() => {
          setError("Workspace data is unavailable.");
          setIsLoading(false);
        });
      }
    }

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [flightNo, hydrateInventory, addBuiltUld]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLogicalNowMs(
        clockAnchor.baseMs +
          (Date.now() - clockAnchor.startedAtMs) * LOGICAL_MULTIPLIER,
      );
      setMonitorStages(readMonitorStages(flightNo));
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [clockAnchor, flightNo]);

  const builtEntries = buildWorkspaceEntries(
    builtUlds,
    builtContents,
    monitorStages,
    auditEvents,
    logicalNowMs,
  );
  const assignedUldByWaybill = buildAssignedUldMap(builtUlds, builtContents);
  const assignedWaybillIds = useMemo(
    () => new Set(Object.keys(assignedUldByWaybill)),
    [assignedUldByWaybill],
  );
  const unassignedShipments = shipments.filter(
    (shipment) => !assignedWaybillIds.has(shipment["@id"]),
  );
  const availableInventoryCount = inventory.filter(
    (uld) => isEligibleInventoryUld(uld) && uld.buildUpStatus !== "in-build-up",
  ).length;
  const autoBuildPreview = useMemo(
    () =>
      autoBuildFlight({
        assignedWaybillIds,
        inventory,
        shipments,
        specs: uldSpecs,
      }),
    [assignedWaybillIds, inventory, shipments],
  );

  function openBuildUp(uld: InventoryUld) {
    if (!isEligibleInventoryUld(uld)) {
      return;
    }

    if (uld.buildUpStatus !== "in-build-up") {
      markInBuildUp(uld["@id"]);
    }

    router.push(
      `/flight/${encodeURIComponent(flightNo)}/build/${encodeURIComponent(uld.uldSerialNumber)}`,
    );
  }

  function handleBuildNewUld() {
    setPickerOpen(true);
  }

  async function handleAutoBuild() {
    const result = autoBuildFlight({
      assignedWaybillIds,
      inventory,
      shipments,
      specs: uldSpecs,
    });

    if (result.plans.length === 0) {
      setAutoBuildMessage("No compatible ready ULDs for remaining AWBs.");
      return;
    }

    let signedCount = 0;
    for (const plan of result.plans) {
      const sealNumber = `AUTO-${plan.uld.uldSerialNumber}-${Date.now()}`;
      const sealedUld: ULD = { ...plan.uld, sealNumber };
      const pieces = plan.shipments.flatMap((wb) => wb.pieces);

      try {
        const { loading, event } = signOff(
          sealedUld,
          pieces,
          sealNumber,
          "warehouse-cool-room",
        );
        publishLoading(loading);
        publishLogisticsEvent(event);
        await auditDb.loadings.put(loading, loading["@id"]);
        await auditDb.events.put(event, event["@id"]);

        addBuiltUld(sealedUld, plan.shipments);
        releaseFromBuildUp(plan.uld["@id"]);
        signedCount += 1;
      } catch (error) {
        console.error(
          "Auto-build sign-off failed for",
          plan.uld.uldSerialNumber,
          error,
        );
        markInBuildUp(plan.uld["@id"]);
      }
    }

    const awbCount = result.plans.reduce(
      (sum, plan) => sum + plan.shipments.length,
      0,
    );
    setAutoBuildMessage(
      `${signedCount} ULDs signed off for ${awbCount} AWBs. ${result.unassigned.length} AWBs remain unassigned.`,
    );
  }

  function openAssignedUld(uldSerialNumber: string) {
    router.push(`/uld/${encodeURIComponent(uldSerialNumber)}`);
  }

  const headerRoute = `${formatLocation(flight?.departureLocation)}→${formatLocation(
    flight?.arrivalLocation,
  )}`;

  return (
    <MissionShell>
      <MissionTopBar
        eyebrow="Flight workspace"
        title={flightNo}
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Flights</Link>
            </Button>
            <Badge variant="secondary">{headerRoute}</Badge>
            <Badge variant="outline">ETD {formatFlightTime(flight)}</Badge>
            {error ? <Badge variant="destructive">{error}</Badge> : null}
            {!error && isLoading ? (
              <Badge variant="secondary">Loading</Badge>
            ) : null}
          </>
        }
      />

      <main className="grid h-[calc(100dvh-4rem)] w-full grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-4 py-4 sm:px-6">
        <Card className="mission-panel border-border/80">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(120px,0.58fr))_auto]">
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Flight build-up
              </div>
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <h1 className="truncate text-3xl font-bold">{flightNo}</h1>
                <Badge variant="secondary">{headerRoute}</Badge>
              </div>
            </div>
            <MetricTile
              label="ETD"
              value={formatFlightTime(flight)}
              meta="Scheduled push"
            />
            <MetricTile
              label="AWBs"
              value={shipments.length}
              meta={getShipmentMix(shipments)}
            />
            <MetricTile
              label="Open"
              value={unassignedShipments.length}
              meta="Unassigned AWBs"
            />
            <MetricTile
              label="Built"
              value={builtEntries.length}
              meta="ULDs signed off"
            />
            <MetricTile
              label="Ready ULDs"
              value={availableInventoryCount}
              meta={`${autoBuildPreview.plans.length} auto plan`}
            />
            {/* <div className="flex flex-col justify-center gap-2">
              <Button
                disabled={availableInventoryCount === 0}
                onClick={handleBuildNewUld}
                variant="outline"
              >
                <PackagePlus data-icon="inline-start" />
                Pick ULD
              </Button>
              <Button
                disabled={autoBuildPreview.plans.length === 0}
                onClick={handleAutoBuild}
              >
                <Wand2 data-icon="inline-start" />
                Auto build
              </Button>
            </div> */}
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-4 overflow-hidden xl:grid-cols-[minmax(320px,0.82fr)_minmax(460px,1.22fr)_300px]">
          <section className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:col-span-2">
            <div className="min-h-0">
              <AwbManifestPanel
                shipments={shipments}
                assignedUldByWaybill={assignedUldByWaybill}
                isLoading={isLoading}
                onOpenAssignedUld={openAssignedUld}
              />
            </div>

            <div className="min-h-0">
              <BuiltUldStrip
                entries={builtEntries}
                monitorHref={`/flight/${encodeURIComponent(flightNo)}/monitor`}
                openAwbCount={unassignedShipments.length}
                onOpenUld={(uldSerialNumber) =>
                  router.push(`/uld/${encodeURIComponent(uldSerialNumber)}`)
                }
              />
            </div>
          </section>

          <StatusRail className="min-h-0 overflow-y-auto">
            <div className="grid gap-2">
              <Button
                disabled={autoBuildPreview.plans.length === 0}
                onClick={handleAutoBuild}
              >
                <Wand2 data-icon="inline-start" />
                Auto build compatible AWBs
              </Button>
              <Button
                disabled={availableInventoryCount === 0}
                onClick={handleBuildNewUld}
                variant="outline"
              >
                <PackagePlus data-icon="inline-start" />
                Open ULD picker
              </Button>
            </div>
            <MetricTile label="Route" value={headerRoute} meta="Airport pair" />
            <MetricTile
              label="Compatibility"
              value={autoBuildPreview.plans.length}
              meta="ULDs in auto plan"
            />
            <MetricTile
              label="Assignable"
              value={autoBuildPreview.plans.reduce(
                (sum, plan) => sum + plan.shipments.length,
                0,
              )}
              meta="AWBs matched"
            />
            <MetricTile
              label="Remainder"
              value={autoBuildPreview.unassigned.length}
              meta="Needs manual review"
            />

            <div
              className={cn(
                "border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground",
                autoBuildMessage && "border-primary/40 bg-primary/5",
              )}
            >
              {autoBuildMessage ??
                "Auto build groups AWBs by SHC support, ULD product capability, type requirements, and conservative weight limits."}
            </div>
          </StatusRail>
        </div>
      </main>

      <UldPickerSheet
        flightNo={flightNo}
        inventory={inventory}
        isLoading={isLoading}
        onOpenBuildUp={openBuildUp}
        onOpenChange={setPickerOpen}
        open={pickerOpen}
        specs={uldSpecs}
      />
    </MissionShell>
  );
}
