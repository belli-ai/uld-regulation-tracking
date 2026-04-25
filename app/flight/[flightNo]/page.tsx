"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { AwbManifestPanel } from "@/components/awb-manifest-panel";
import {
  BuiltUldStrip,
  type BuiltUldStripEntry,
} from "@/components/built-uld-strip";
import { UldInventoryPanel } from "@/components/uld-inventory-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ULD, TransportMovement, Waybill } from "@/lib/ontology/one-record";
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
      shc: shcCodes.length === 1 ? shcCodes[0] : shcCodes.length > 1 ? "MIX" : "TBD",
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
            flightsData.find((candidate) => candidate.flightNumber === flightNo) ??
              null,
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
      (uld) => isEligibleInventoryUld(uld) && uld.buildUpStatus !== "in-build-up",
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Flights</Link>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Workspace
              </span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-semibold">{flightNo}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{headerRoute}</Badge>
            <Badge variant="outline">ETD {formatFlightTime(flight)}</Badge>
            <Badge variant="outline">{shipments.length} AWBs</Badge>
            <Badge variant="outline">{availableInventoryCount} ready ULDs</Badge>
            {error ? <Badge variant="destructive">{error}</Badge> : null}
            {!error && isLoading ? <Badge variant="secondary">Loading</Badge> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid h-[calc(100vh-3.5rem)] max-w-7xl grid-cols-[1fr_1fr] grid-rows-[1fr_auto] gap-6 px-6 py-8">
        <div className="min-h-0">
          <AwbManifestPanel
            shipments={shipments}
            assignedUldByWaybill={assignedUldByWaybill}
            isLoading={isLoading}
            onOpenAssignedUld={openAssignedUld}
          />
        </div>

        <div className="min-h-0">
          <UldInventoryPanel
            flightNo={flightNo}
            inventory={inventory}
            isLoading={isLoading}
            onBuildNewUld={handleBuildNewUld}
            onOpenBuildUp={openBuildUp}
          />
        </div>

        <div className="col-span-2 min-h-0">
          <BuiltUldStrip
            entries={builtEntries}
            onOpenUld={(uldSerialNumber) =>
              router.push(`/uld/${encodeURIComponent(uldSerialNumber)}`)
            }
          />
        </div>
      </main>
    </div>
  );
}
