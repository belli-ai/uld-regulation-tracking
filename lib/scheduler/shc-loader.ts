import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TemperatureInstructions } from "@/lib/ontology/one-record";

type TemperatureRange = Pick<
  TemperatureInstructions,
  "minTemperature" | "maxTemperature"
>;

type AmbientCurveKey = `ambient${number}c`;

export type AmbientCurve = Record<AmbientCurveKey, number>;

export type ShcEntry = {
  label: string;
  description: string;
  temperatureInstructions: TemperatureRange;
  maxWaitMinutes: AmbientCurve;
  urgencyPriority: number;
  color: string;
  icon: string;
  autoHoldThresholdMinutes: number;
  requiresVetClearance?: boolean;
};

export type ShcConfig = {
  shc: Record<string, ShcEntry>;
  default: ShcEntry;
};

const DEFAULT_CONFIG_PATH = "public/config/shc.json";
const AMBIENT_KEY_PATTERN = /^ambient(-?\d+(?:\.\d+)?)c$/i;

export async function loadShcConfig(path = DEFAULT_CONFIG_PATH): Promise<ShcConfig> {
  const filePath = resolve(process.cwd(), path);
  const raw = await readFile(filePath, "utf8");
  return parseShcConfig(JSON.parse(raw) as unknown);
}

export function parseShcConfig(raw: unknown): ShcConfig {
  const root = asRecord(raw, "SHC config root");
  const shc = asRecord(root.shc, "shc");

  return {
    shc: Object.fromEntries(
      Object.entries(shc).map(([code, entry]) => [code, parseShcEntry(entry, `shc.${code}`)]),
    ),
    default: parseShcEntry(root.default, "default"),
  };
}

export function getShcEntry(
  config: ShcConfig,
  shcCode: string,
): ShcEntry | undefined {
  return config.shc[shcCode];
}

export function linearInterpolate(
  ambientC: number,
  curve: Record<string, number>,
): number {
  const points = Object.entries(curve)
    .map(([key, value]) => {
      const match = AMBIENT_KEY_PATTERN.exec(key);
      if (!match) {
        return null;
      }

      return {
        ambientC: Number.parseFloat(match[1]),
        minutes: value,
      };
    })
    .filter((point): point is { ambientC: number; minutes: number } => point !== null)
    .sort((left, right) => left.ambientC - right.ambientC);

  if (points.length === 0) {
    throw new Error("Ambient curve must contain at least one ambientNc entry");
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (ambientC <= first.ambientC) {
    return first.minutes;
  }

  if (ambientC >= last.ambientC) {
    return last.minutes;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];

    if (ambientC >= current.ambientC && ambientC <= next.ambientC) {
      const span = next.ambientC - current.ambientC;
      if (span === 0) {
        return current.minutes;
      }

      const ratio = (ambientC - current.ambientC) / span;
      return current.minutes + (next.minutes - current.minutes) * ratio;
    }
  }

  return last.minutes;
}

function parseShcEntry(raw: unknown, label: string): ShcEntry {
  const entry = asRecord(raw, label);

  return {
    label: asString(entry.label, `${label}.label`),
    description: asString(entry.description, `${label}.description`),
    temperatureInstructions: parseTemperatureInstructions(
      entry.temperatureInstructions,
      `${label}.temperatureInstructions`,
    ),
    maxWaitMinutes: parseAmbientCurve(entry.maxWaitMinutes, `${label}.maxWaitMinutes`),
    urgencyPriority: asNumber(entry.urgencyPriority, `${label}.urgencyPriority`),
    color: asString(entry.color, `${label}.color`),
    icon: asString(entry.icon, `${label}.icon`),
    autoHoldThresholdMinutes: asNumber(
      entry.autoHoldThresholdMinutes,
      `${label}.autoHoldThresholdMinutes`,
    ),
    requiresVetClearance:
      entry.requiresVetClearance === undefined
        ? undefined
        : asBoolean(entry.requiresVetClearance, `${label}.requiresVetClearance`),
  };
}

function parseTemperatureInstructions(
  raw: unknown,
  label: string,
): TemperatureRange {
  const range = asRecord(raw, label);

  return {
    minTemperature: parseTemperatureValue(range.minTemperature, `${label}.minTemperature`),
    maxTemperature: parseTemperatureValue(range.maxTemperature, `${label}.maxTemperature`),
  };
}

function parseTemperatureValue(
  raw: unknown,
  label: string,
): TemperatureRange["minTemperature"] {
  const value = asRecord(raw, label);
  const unit = asString(value.unit, `${label}.unit`);

  if (unit !== "C" && unit !== "F") {
    throw new Error(`${label}.unit must be C or F`);
  }

  return {
    value: asNumber(value.value, `${label}.value`),
    unit,
  };
}

function parseAmbientCurve(raw: unknown, label: string): AmbientCurve {
  const curve = asRecord(raw, label);
  const parsedEntries = Object.entries(curve).map(([key, value]) => {
    if (!AMBIENT_KEY_PATTERN.test(key)) {
      throw new Error(`${label}.${key} must match ambientNc`);
    }

    return [key as AmbientCurveKey, asNumber(value, `${label}.${key}`)] as const;
  });

  if (parsedEntries.length === 0) {
    throw new Error(`${label} must contain at least one curve point`);
  }

  return Object.fromEntries(parsedEntries) as AmbientCurve;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }

  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}
