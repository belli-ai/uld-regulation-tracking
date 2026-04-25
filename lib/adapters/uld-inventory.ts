import { toIRI, type ULD } from "@/lib/ontology/one-record";

type RawUld = {
  "@id"?: unknown;
  uldSerialNumber?: unknown;
  uldTypeCode?: unknown;
  ataDesignator?: unknown;
  serviceabilityCode?: unknown;
  damageFlag?: unknown;
  ownerCode?: unknown;
  numberOfDoors?: unknown;
  loadingIndicator?: unknown;
  sealNumber?: unknown;
};

const ALLOWED_SERVICEABILITY = new Set(["SER", "DAM", "CON"]);

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`uld-inventory adapter: missing or invalid '${field}'`);
  }
  return value;
}

function asServiceability(value: unknown): ULD["serviceabilityCode"] {
  if (typeof value === "string" && ALLOWED_SERVICEABILITY.has(value)) {
    return value as ULD["serviceabilityCode"];
  }
  return "SER";
}

export function adaptOneUld(raw: RawUld): ULD {
  const uld: ULD = {
    "@id": toIRI(asString(raw["@id"], "uld.@id")),
    "@type": "ULD",
    uldSerialNumber: asString(raw.uldSerialNumber, "uldSerialNumber"),
    uldTypeCode: asString(raw.uldTypeCode, "uldTypeCode"),
    serviceabilityCode: asServiceability(raw.serviceabilityCode),
    damageFlag: raw.damageFlag === true,
    ownerCode: asString(raw.ownerCode, "ownerCode"),
  };
  if (typeof raw.sealNumber === "string" && raw.sealNumber.length > 0) {
    uld.sealNumber = raw.sealNumber;
  }
  if (
    typeof raw.numberOfDoors === "number" &&
    Number.isFinite(raw.numberOfDoors)
  ) {
    uld.numberOfDoors = raw.numberOfDoors;
  }
  if (
    typeof raw.loadingIndicator === "string" &&
    raw.loadingIndicator.length > 0
  ) {
    uld.loadingIndicator = raw.loadingIndicator;
  }
  if (typeof raw.ataDesignator === "string" && raw.ataDesignator.length > 0) {
    uld.ataDesignator = raw.ataDesignator;
  }
  return uld;
}

export function adaptMockUldInventory(raw: unknown): ULD[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => adaptOneUld(entry as RawUld));
}
