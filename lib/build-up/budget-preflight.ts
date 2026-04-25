import { integrateBudget } from "../physics/pcm-model";
import {
  toIRI,
  type Measurement,
  type Piece,
  type TemperatureInstructions,
  type ULD,
} from "../ontology/one-record";
import { getUldSpec, type UldPhysicsSpec } from "../physics/uld-specs-loader";

export type AmbientCurve = Measurement[];

type UldWithBudgetFields = ULD & {
  uldProductCode?: unknown;
  lastKnownInternalC?: unknown;
};

type PieceWithBuildUpFields = Piece & {
  shc?: unknown;
  temperatureInstructions?: unknown;
};

type IntegrateBudgetResult = {
  budgetSec: number;
  breachAt: Date | null;
};

type TemperatureRange = {
  minC: number;
  maxC: number;
};

const SHC_RANGES: Record<string, TemperatureRange> = {
  AVI: { minC: 18, maxC: 26 },
  COL: { minC: 2, maxC: 8 },
  CRT: { minC: 15, maxC: 25 },
  FRO: { minC: -25, maxC: -15 },
  HEG: { minC: 18, maxC: 22 },
  PER: { minC: 2, maxC: 8 },
};

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toCelsius(value: number, unit: "C" | "F"): number {
  if (unit === "C") {
    return value;
  }
  return ((value - 32) * 5) / 9;
}

function getTemperatureRange(piece: Piece): TemperatureRange | undefined {
  const candidate = piece as PieceWithBuildUpFields;
  if (candidate.temperatureInstructions != null) {
    const instructions = candidate.temperatureInstructions as {
      minTemperature?: { value?: unknown; unit?: unknown };
      maxTemperature?: { value?: unknown; unit?: unknown };
    };
    const min = asNumber(instructions.minTemperature?.value);
    const max = asNumber(instructions.maxTemperature?.value);
    const minUnit = instructions.minTemperature?.unit;
    const maxUnit = instructions.maxTemperature?.unit;

    if (
      min != null &&
      max != null &&
      (minUnit === "C" || minUnit === "F") &&
      (maxUnit === "C" || maxUnit === "F")
    ) {
      return {
        minC: toCelsius(min, minUnit),
        maxC: toCelsius(max, maxUnit),
      };
    }
  }

  if (typeof candidate.shc === "string") {
    return SHC_RANGES[candidate.shc];
  }

  return undefined;
}

function midpointFromPiece(piece: Piece): number | undefined {
  const range = getTemperatureRange(piece);
  if (!range) {
    return undefined;
  }
  return (range.minC + range.maxC) / 2;
}

function deriveInternalTemperature(uld: ULD, pieces: Piece[]): number {
  const candidate = uld as UldWithBudgetFields;
  const current = asNumber(candidate.lastKnownInternalC);
  if (current != null) {
    return current;
  }

  const midpoints = pieces
    .map((piece) => midpointFromPiece(piece))
    .filter((value): value is number => value != null);
  if (midpoints.length > 0) {
    return midpoints.reduce((sum, value) => sum + value, 0) / midpoints.length;
  }

  return 20;
}

function deriveUldSpec(uld: ULD): UldPhysicsSpec {
  const candidate = uld as UldWithBudgetFields;
  const specId =
    typeof candidate.uldProductCode === "string"
      ? candidate.uldProductCode
      : "GENERIC_PASSIVE";
  return getUldSpec(specId);
}

function deriveThreshold(pieces: Piece[]): TemperatureInstructions {
  const ranges = pieces
    .map((piece) => getTemperatureRange(piece))
    .filter((range): range is TemperatureRange => range != null);

  if (ranges.length === 0) {
    return {
      "@id": toIRI("urn:cargo:tempinstr:default"),
      "@type": "TemperatureInstructions",
      minTemperature: { value: 15, unit: "C" },
      maxTemperature: { value: 25, unit: "C" },
    };
  }

  const minC = Math.max(...ranges.map((range) => range.minC));
  const maxC = Math.min(...ranges.map((range) => range.maxC));

  return {
    "@id": toIRI("urn:cargo:tempinstr:build-up-threshold"),
    "@type": "TemperatureInstructions",
    minTemperature: { value: minC, unit: "C" },
    maxTemperature: { value: maxC >= minC ? maxC : minC, unit: "C" },
  };
}

function toWarning(budgetH: number): "green" | "yellow" | "red" {
  if (budgetH >= 4) {
    return "green";
  }
  if (budgetH >= 2) {
    return "yellow";
  }
  return "red";
}

export const budgetPreflight = {
  forecast(
    uld: ULD,
    pieces: Piece[],
    projectedAmbient: AmbientCurve,
  ): { budgetH: number; breachAt: string | null; warning: "green" | "yellow" | "red" } {
    const result = integrateBudget(
      deriveUldSpec(uld),
      deriveInternalTemperature(uld, pieces),
      projectedAmbient,
      60,
      deriveThreshold(pieces),
    ) as IntegrateBudgetResult;

    const budgetH = result.budgetSec / 3600;

    return {
      budgetH,
      breachAt: result.breachAt?.toISOString() ?? null,
      warning: toWarning(budgetH),
    };
  },
};
