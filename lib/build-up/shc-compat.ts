import type { Piece, TemperatureInstructions } from "../ontology/one-record";

type TemperatureRange = {
  minC: number;
  maxC: number;
};

type PieceWithBuildUpFields = Piece & {
  shc?: unknown;
  temperatureInstructions?: unknown;
};

export type ConflictReason = {
  pieceIds: [Piece["@id"], Piece["@id"]];
  shcCodes: [string, string];
  rangesC: [TemperatureRange, TemperatureRange];
  reason: string;
};

const SHC_RANGES: Record<string, TemperatureRange> = {
  AVI: { minC: 18, maxC: 26 },
  COL: { minC: 2, maxC: 8 },
  CRT: { minC: 15, maxC: 25 },
  FRO: { minC: -25, maxC: -15 },
  HEG: { minC: 18, maxC: 22 },
  PER: { minC: 2, maxC: 8 },
};

function toCelsius(value: number, unit: "C" | "F"): number {
  if (unit === "C") {
    return value;
  }
  return ((value - 32) * 5) / 9;
}

function asTemperatureInstructions(
  value: unknown,
): TemperatureInstructions | undefined {
  if (value == null || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<TemperatureInstructions>;
  if (
    candidate.minTemperature?.unit !== "C" &&
    candidate.minTemperature?.unit !== "F"
  ) {
    return undefined;
  }
  if (
    candidate.maxTemperature?.unit !== "C" &&
    candidate.maxTemperature?.unit !== "F"
  ) {
    return undefined;
  }
  if (
    typeof candidate.minTemperature.value !== "number" ||
    typeof candidate.maxTemperature.value !== "number"
  ) {
    return undefined;
  }

  return candidate as TemperatureInstructions;
}

function getRange(piece: Piece): TemperatureRange | undefined {
  const candidate = piece as PieceWithBuildUpFields;
  const instructions = asTemperatureInstructions(candidate.temperatureInstructions);
  if (instructions) {
    return {
      minC: toCelsius(
        instructions.minTemperature.value,
        instructions.minTemperature.unit,
      ),
      maxC: toCelsius(
        instructions.maxTemperature.value,
        instructions.maxTemperature.unit,
      ),
    };
  }

  if (typeof candidate.shc === "string") {
    return SHC_RANGES[candidate.shc];
  }

  return undefined;
}

function getShcCode(piece: Piece): string {
  const candidate = piece as PieceWithBuildUpFields;
  return typeof candidate.shc === "string" ? candidate.shc : "UNKNOWN";
}

function rangesOverlap(left: TemperatureRange, right: TemperatureRange): boolean {
  return Math.max(left.minC, right.minC) <= Math.min(left.maxC, right.maxC);
}

export const shcCompat = {
  compatible(pieces: Piece[]): { ok: boolean; conflicts: ConflictReason[] } {
    const conflicts: ConflictReason[] = [];

    for (let leftIndex = 0; leftIndex < pieces.length; leftIndex += 1) {
      const leftPiece = pieces[leftIndex];
      const leftRange = getRange(leftPiece);
      if (!leftRange) {
        continue;
      }

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < pieces.length;
        rightIndex += 1
      ) {
        const rightPiece = pieces[rightIndex];
        const rightRange = getRange(rightPiece);
        if (!rightRange || rangesOverlap(leftRange, rightRange)) {
          continue;
        }

        conflicts.push({
          pieceIds: [leftPiece["@id"], rightPiece["@id"]],
          shcCodes: [getShcCode(leftPiece), getShcCode(rightPiece)],
          rangesC: [leftRange, rightRange],
          reason: `Temperature range mismatch: ${getShcCode(leftPiece)} requires ${leftRange.minC}-${leftRange.maxC}C while ${getShcCode(rightPiece)} requires ${rightRange.minC}-${rightRange.maxC}C`,
        });
      }
    }

    return {
      ok: conflicts.length === 0,
      conflicts,
    };
  },
};
