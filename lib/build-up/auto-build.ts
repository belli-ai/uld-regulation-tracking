import type { ULD, Waybill } from "@/lib/ontology/one-record";

export type AutoBuildUld = ULD & {
  buildUpStatus?: "available" | "in-build-up";
  uldProductCode?: string;
};

export type AutoBuildUldSpec = {
  label: string;
  productCode: string;
  ratedAutonomyHoursAt25C: number;
  supportedShc: string[];
  uldType: string;
};

export type AutoBuildPlan = {
  shc: string;
  shipments: Waybill[];
  specLabel: string;
  totalWeightKg: number;
  uld: AutoBuildUld;
};

export type AutoBuildResult = {
  plans: AutoBuildPlan[];
  unassigned: Waybill[];
};

type Options = {
  assignedWaybillIds: ReadonlySet<string>;
  inventory: AutoBuildUld[];
  shipments: Waybill[];
  specs: Record<string, AutoBuildUldSpec>;
};

const ULD_CAPACITY_KG: Record<string, number> = {
  AAU: 4600,
  AAY: 6800,
  AKE: 1500,
  AKH: 1500,
  AKW: 1500,
  PMC: 6800,
  RKN: 1500,
};

const SHC_PRIORITY: Record<string, number> = {
  AVI: 0,
  FRO: 1,
  COL: 2,
  PER: 3,
  CRT: 4,
  HEG: 5,
};

function weightKg(waybill: Waybill): number {
  return waybill.pieces.reduce((sum, piece) => {
    const weight =
      piece.grossWeight.unit === "lb"
        ? piece.grossWeight.value * 0.453592
        : piece.grossWeight.value;

    return sum + weight;
  }, 0);
}

function totalWeightKg(waybills: Waybill[]): number {
  return waybills.reduce((sum, waybill) => sum + weightKg(waybill), 0);
}

function isEligible(uld: AutoBuildUld): boolean {
  return (
    uld.serviceabilityCode === "SER" &&
    !uld.damageFlag &&
    uld.buildUpStatus !== "in-build-up"
  );
}

function getSpec(
  uld: AutoBuildUld,
  specs: Record<string, AutoBuildUldSpec>,
): AutoBuildUldSpec | null {
  return uld.uldProductCode ? (specs[uld.uldProductCode] ?? null) : null;
}

function getCapacityKg(uld: AutoBuildUld): number {
  return ULD_CAPACITY_KG[uld.uldTypeCode] ?? 1200;
}

function getShcPriority(shc: string): number {
  return SHC_PRIORITY[shc] ?? 99;
}

function supportsShipment(
  uld: AutoBuildUld,
  spec: AutoBuildUldSpec | null,
  shipment: Waybill,
): boolean {
  if (!spec?.supportedShc.includes(shipment.shc)) {
    return false;
  }

  return shipment.pieces.every(
    (piece) =>
      !piece.fulfillsUldTypeCode ||
      piece.fulfillsUldTypeCode === uld.uldTypeCode,
  );
}

function canAddShipment(
  uld: AutoBuildUld,
  spec: AutoBuildUldSpec | null,
  shipments: Waybill[],
  candidate: Waybill,
): boolean {
  if (!supportsShipment(uld, spec, candidate)) {
    return false;
  }

  const nextShipments = [...shipments, candidate];
  if (totalWeightKg(nextShipments) > getCapacityKg(uld)) {
    return false;
  }

  return nextShipments.every((shipment) =>
    spec?.supportedShc.includes(shipment.shc),
  );
}

function sortShipments(left: Waybill, right: Waybill): number {
  const priorityDelta = getShcPriority(left.shc) - getShcPriority(right.shc);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return weightKg(right) - weightKg(left);
}

function sortUlds(
  specs: Record<string, AutoBuildUldSpec>,
): (left: AutoBuildUld, right: AutoBuildUld) => number {
  return (left, right) => {
    const leftSpec = getSpec(left, specs);
    const rightSpec = getSpec(right, specs);
    const leftShcCount = leftSpec?.supportedShc.length ?? 99;
    const rightShcCount = rightSpec?.supportedShc.length ?? 99;
    if (leftShcCount !== rightShcCount) {
      return leftShcCount - rightShcCount;
    }

    const autonomyDelta =
      (rightSpec?.ratedAutonomyHoursAt25C ?? 0) -
      (leftSpec?.ratedAutonomyHoursAt25C ?? 0);
    if (autonomyDelta !== 0) {
      return autonomyDelta;
    }

    return left.uldSerialNumber.localeCompare(right.uldSerialNumber);
  };
}

export function autoBuildFlight({
  assignedWaybillIds,
  inventory,
  shipments,
  specs,
}: Options): AutoBuildResult {
  let remaining = shipments
    .filter((shipment) => !assignedWaybillIds.has(shipment["@id"]))
    .toSorted(sortShipments);
  const plans: AutoBuildPlan[] = [];

  const availableUlds = inventory.filter(isEligible).toSorted(sortUlds(specs));

  for (const uld of availableUlds) {
    const spec = getSpec(uld, specs);
    const plannedShipments: Waybill[] = [];

    for (const shipment of remaining) {
      if (canAddShipment(uld, spec, plannedShipments, shipment)) {
        plannedShipments.push(shipment);
      }
    }

    if (plannedShipments.length === 0) {
      continue;
    }

    const plannedIds = new Set(
      plannedShipments.map((shipment) => shipment["@id"]),
    );
    remaining = remaining.filter((shipment) => !plannedIds.has(shipment["@id"]));

    plans.push({
      shc:
        Array.from(new Set(plannedShipments.map((shipment) => shipment.shc)))
          .sort()
          .join("+") || "TBD",
      shipments: plannedShipments,
      specLabel: spec?.label ?? uld.uldTypeCode,
      totalWeightKg: totalWeightKg(plannedShipments),
      uld,
    });

    if (remaining.length === 0) {
      break;
    }
  }

  return {
    plans,
    unassigned: remaining,
  };
}
