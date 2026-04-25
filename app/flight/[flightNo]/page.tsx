"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { AwbManifestPanel } from "@/components/awb-manifest-panel";
import {
  BuiltUldStrip,
  type BuiltUldStripEntry,
} from "@/components/built-uld-strip";
import {
  MetricTile,
  MissionHero,
  MissionShell,
  MissionTopBar,
  StatusRail,
} from "@/components/mission-control";
import { UldInventoryPanel } from "@/components/uld-inventory-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ULD,
  TransportMovement,
  Waybill,
} from "@/lib/ontology/one-record";
import {
  useInventoryStore,
  type InventoryUld,
} from "@/lib/stores/inventory-store";
import { useUldStore } from "@/lib/stores/uld-store";

declare module "react" {
  interface Attributes {
    indicatorClassName?: string;
  }
}

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
): BuiltUldStripEntry[] {
  return ulds.map((uld) => {
    const waybills = contents[uld["@id"]] ?? [];
    const shcCodes = Array.from(
      new Set(waybills.map((waybill) => waybill.shc).filter(Boolean)),
    );

    return {
      uld,
      awbCount: waybills.length,
      currentState: "warehouse",
      shc:
        shcCodes.length === 1
          ? shcCodes[0]
          : shcCodes.length > 1
            ? "MIX"
            : "TBD",
      thermalBudgetLabel: "Budget pending",
    };
  });
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
  const builtUlds = useUldStore((state) => state.ulds);
  const builtContents = useUldStore((state) => state.contents);

  const [flight, setFlight] = useState<TransportMovement | null>(null);
  const [shipments, setShipments] = useState<Waybill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        startTransition(() => {
          setFlight(
            flightsData.find(
              (candidate) => candidate.flightNumber === flightNo,
            ) ?? null,
          );
          setShipments(shipmentsData);
          hydrateInventory(inventoryData);
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
  }, [flightNo, hydrateInventory]);

  const builtEntries = buildWorkspaceEntries(builtUlds, builtContents);
  const assignedUldByWaybill = buildAssignedUldMap(builtUlds, builtContents);
  const availableInventoryCount = inventory.filter(
    (uld) => isEligibleInventoryUld(uld) && uld.buildUpStatus !== "in-build-up",
  ).length;

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
    const nextAvailable = inventory.find(
      (uld) =>
        isEligibleInventoryUld(uld) && uld.buildUpStatus !== "in-build-up",
    );

    if (!nextAvailable) {
      return;
    }

    openBuildUp(nextAvailable);
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

      <main className="grid w-full gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <MissionHero
            eyebrow="Load planning console"
            title={flightNo}
            description={`${headerRoute} mission workspace. Build ULDs from manifest demand, available equipment, and cold-chain readiness.`}
            actions={
              <Button
                disabled={availableInventoryCount === 0}
                onClick={handleBuildNewUld}
              >
                + Build new ULD
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Manifest"
                value={shipments.length}
                meta="AWBs queued"
              />
              <MetricTile
                label="Inventory"
                value={availableInventoryCount}
                meta="Ready ULDs"
              />
              <MetricTile
                label="Built"
                value={builtEntries.length}
                meta="ULDs signed off"
              />
            </div>
          </MissionHero>

          <div className="grid min-h-[560px] gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
                onOpenUld={(uldSerialNumber) =>
                  router.push(`/uld/${encodeURIComponent(uldSerialNumber)}`)
                }
              />
            </div>
          </div>
        </section>

        <StatusRail className="min-h-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)]">
          <MetricTile label="Route" value={headerRoute} meta="Airport pair" />
          <MetricTile
            label="ETD"
            value={formatFlightTime(flight)}
            meta="Scheduled push"
          />
          <MetricTile
            label="AWBs"
            value={shipments.length}
            meta="Manifest demand"
          />
          <div className="min-h-0 flex-1">
            <UldInventoryPanel
              flightNo={flightNo}
              inventory={inventory}
              isLoading={isLoading}
              onBuildNewUld={handleBuildNewUld}
              onOpenBuildUp={openBuildUp}
            />
          </div>
        </StatusRail>
      </main>
    </MissionShell>
  );
}
