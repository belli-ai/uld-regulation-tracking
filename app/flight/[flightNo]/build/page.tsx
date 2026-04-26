import { redirect } from "next/navigation";
import uldInventoryFixture from "@/public/data/uld-inventory.json";
import { adaptMockUldInventory } from "@/lib/adapters/uld-inventory";

type Props = {
  params: Promise<{
    flightNo: string;
  }>;
};

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function firstServiceableUldSerial(): string | null {
  try {
    const inventory = adaptMockUldInventory(uldInventoryFixture);
    return (
      inventory.find(
        (uld) => uld.serviceabilityCode === "SER" && !uld.damageFlag,
      )?.uldSerialNumber ?? null
    );
  } catch (error) {
    console.error("Build-up ULD fallback failed", error);
    return null;
  }
}

export default async function BuildUpIndexPage({ params }: Props) {
  const { flightNo: routeFlightNo } = await params;
  const flightNo = decodeRouteSegment(routeFlightNo);
  const uldSerialNumber = firstServiceableUldSerial();
  const flightSegment = encodeURIComponent(flightNo);

  if (!uldSerialNumber) {
    redirect(`/flight/${flightSegment}`);
  }

  redirect(
    `/flight/${flightSegment}/build/${encodeURIComponent(uldSerialNumber)}`,
  );
}
