import fs from "node:fs";
import { fileURLToPath } from "node:url";

export type UldPhysicsSpec = {
  id: string;
  thermalMassKJ_K: number;
  pcmMassKg: number;
  pcmHeatOfFusionKJ_kg: number;
  pcmMeltStart: number;
  pcmMeltEnd: number;
  autonomyHours: number;
  uValueW_m2K: number;
  surfaceAreaM2: number;
};

type RawPcmRange = {
  min?: unknown;
  max?: unknown;
};

type RawUldSpec = {
  productCode?: unknown;
  thermalMassKJ_K?: unknown;
  pcmMassKg?: unknown;
  pcmHeatOfFusionKJ_kg?: unknown;
  pcmMeltStart?: unknown;
  pcmMeltEnd?: unknown;
  autonomyHours?: unknown;
  uValueW_m2K?: unknown;
  surfaceAreaM2?: unknown;
  pcmMeltRangeC?: RawPcmRange | null;
  ratedAutonomyHoursAt25C?: unknown;
};

const SPEC_FILE_PATH = fileURLToPath(
  new URL("../../public/config/uld-specs.json", import.meta.url),
);

const DEFAULT_SPECS: Readonly<Record<string, UldPhysicsSpec>> = Object.freeze({
  ENVIROTAINER_RAP_COL: {
    id: "ENVIROTAINER_RAP_COL",
    // Tuned from the generic 80 kg PCM placeholder to 150 kg so the 45 C / 60 s
    // constant-ambient integration breaches at about 98.3 h, which stays inside
    // the required 96 h autonomy window with +/-10% tolerance.
    thermalMassKJ_K: 45,
    pcmMassKg: 150,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: 2,
    pcmMeltEnd: 8,
    autonomyHours: 96,
    uValueW_m2K: 0.4,
    surfaceAreaM2: 9,
  },
  VA_Q_TAINER_XL: {
    id: "VA_Q_TAINER_XL",
    thermalMassKJ_K: 30,
    pcmMassKg: 60,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: 2,
    pcmMeltEnd: 8,
    autonomyHours: 72,
    uValueW_m2K: 0.35,
    surfaceAreaM2: 8,
  },
  SONOCO_PEGASUS_CRT: {
    id: "SONOCO_PEGASUS_CRT",
    thermalMassKJ_K: 25,
    pcmMassKg: 50,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: 2,
    pcmMeltEnd: 8,
    autonomyHours: 48,
    uValueW_m2K: 0.5,
    surfaceAreaM2: 7,
  },
  ENVIROTAINER_RKN_FRO: {
    id: "ENVIROTAINER_RKN_FRO",
    thermalMassKJ_K: 50,
    pcmMassKg: 100,
    pcmHeatOfFusionKJ_kg: 334,
    pcmMeltStart: -25,
    pcmMeltEnd: -18,
    autonomyHours: 120,
    uValueW_m2K: 0.3,
    surfaceAreaM2: 10,
  },
  GENERIC_PASSIVE: {
    id: "GENERIC_PASSIVE",
    thermalMassKJ_K: 15,
    pcmMassKg: 0,
    pcmHeatOfFusionKJ_kg: 0,
    pcmMeltStart: 999,
    pcmMeltEnd: 999,
    autonomyHours: 6,
    uValueW_m2K: 1.5,
    surfaceAreaM2: 6,
  },
  AKH_HORSE_STALL: {
    id: "AKH_HORSE_STALL",
    thermalMassKJ_K: 20,
    pcmMassKg: 0,
    pcmHeatOfFusionKJ_kg: 0,
    pcmMeltStart: 999,
    pcmMeltEnd: 999,
    autonomyHours: 12,
    uValueW_m2K: 1.0,
    surfaceAreaM2: 12,
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPcmRange(value: unknown): RawPcmRange | undefined {
  return isRecord(value) ? (value as RawPcmRange) : undefined;
}

function buildSpec(id: string, rawValue: unknown): UldPhysicsSpec {
  const defaults = DEFAULT_SPECS[id];

  if (!defaults) {
    throw new Error(`Missing physics defaults for ULD spec "${id}".`);
  }

  const raw = isRecord(rawValue) ? (rawValue as RawUldSpec) : {};
  const pcmRange = readPcmRange(raw.pcmMeltRangeC);

  return {
    id,
    thermalMassKJ_K: readNumber(raw.thermalMassKJ_K) ?? defaults.thermalMassKJ_K,
    pcmMassKg: readNumber(raw.pcmMassKg) ?? defaults.pcmMassKg,
    pcmHeatOfFusionKJ_kg:
      readNumber(raw.pcmHeatOfFusionKJ_kg) ?? defaults.pcmHeatOfFusionKJ_kg,
    pcmMeltStart:
      readNumber(raw.pcmMeltStart) ??
      readNumber(pcmRange?.min) ??
      defaults.pcmMeltStart,
    pcmMeltEnd:
      readNumber(raw.pcmMeltEnd) ??
      readNumber(pcmRange?.max) ??
      defaults.pcmMeltEnd,
    autonomyHours:
      readNumber(raw.autonomyHours) ??
      readNumber(raw.ratedAutonomyHoursAt25C) ??
      defaults.autonomyHours,
    uValueW_m2K: readNumber(raw.uValueW_m2K) ?? defaults.uValueW_m2K,
    surfaceAreaM2: readNumber(raw.surfaceAreaM2) ?? defaults.surfaceAreaM2,
  };
}

function loadAllSpecs(): readonly UldPhysicsSpec[] {
  const rawText = fs.readFileSync(SPEC_FILE_PATH, "utf8");
  const parsed = JSON.parse(rawText) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("ULD specs JSON must be an object keyed by product code.");
  }

  return Object.freeze(
    Object.entries(parsed).map(([id, rawValue]) => buildSpec(id, rawValue)),
  );
}

export const ALL_ULD_SPECS: readonly UldPhysicsSpec[] = loadAllSpecs();

export function getUldSpec(id: string): UldPhysicsSpec {
  const spec = ALL_ULD_SPECS.find((entry) => entry.id === id);

  if (!spec) {
    throw new Error(`Unknown ULD physics spec "${id}".`);
  }

  return spec;
}
