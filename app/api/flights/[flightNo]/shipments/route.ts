import {
  getLogisticsObject,
  isOneConnectEnabled,
  pollNotifications,
} from "@/lib/adapters/one-connect/client";
import { notificationsToWaybills } from "@/lib/adapters/one-connect/waybills";
import { adaptMockShipmentsForFlight } from "@/lib/adapters/shipments";
import type { Waybill } from "@/lib/ontology/one-record";
import shipmentsFixture from "@/public/data/shipments.json";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ flightNo: string }>;
};

type ShipmentsSource = "mock" | "mixed" | "live";

function mergeShipments(mockShipments: Waybill[], liveShipments: Waybill[]) {
  const liveById = new Map(
    liveShipments.map((shipment) => [shipment["@id"], shipment] as const),
  );
  const merged = mockShipments.map(
    (shipment) => liveById.get(shipment["@id"]) ?? shipment,
  );
  const mockIds = new Set(mockShipments.map((shipment) => shipment["@id"]));
  merged.push(
    ...liveShipments.filter((shipment) => !mockIds.has(shipment["@id"])),
  );
  return merged;
}

function sourceFor(
  mockShipments: Waybill[],
  liveShipments: Waybill[],
): ShipmentsSource {
  if (liveShipments.length === 0) {
    return "mock";
  }
  if (mockShipments.length === 0) {
    return "live";
  }
  return "mixed";
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { flightNo } = await ctx.params;

  try {
    const mockShipments = adaptMockShipmentsForFlight(
      shipmentsFixture,
      flightNo,
    );

    if (!isOneConnectEnabled()) {
      return Response.json({ data: mockShipments, source: "mock" });
    }

    const notifications = await pollNotifications({ limit: 100 });
    const { waybills: liveShipments } = await notificationsToWaybills(
      notifications,
      (uri) => getLogisticsObject(uri, { embedded: true }),
    );
    // Sandbox is single-tenant: live Waybills carry no flightNo binding, so all are included as live extras.
    const data = mergeShipments(mockShipments, liveShipments);
    return Response.json({
      data,
      source: sourceFor(mockShipments, liveShipments),
    });
  } catch (err) {
    console.error("GET /api/flights/[flightNo]/shipments failed", err);
    try {
      const data = adaptMockShipmentsForFlight(shipmentsFixture, flightNo);
      return Response.json({ data, source: "mock" });
    } catch {
      return Response.json(
        { error: "shipments fixture unavailable" },
        { status: 503 },
      );
    }
  }
}
