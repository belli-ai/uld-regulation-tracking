#!/usr/bin/env tsx
/*
 * scripts/validate-fixtures.ts
 *
 * Enforces every bullet under MOCK_DATA.md → "Validation rules" plus the
 * scenario shape contract from lib/simulator/scenario-schema.ts.
 *
 * Exits 0 on success. On failure: prints all errors and exits 1.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { scenariosFileSchema } from "../lib/simulator/scenario-schema";

const ROOT = path.resolve(__dirname, "..");

const FIXTURE_PATHS = {
  shc: "public/config/shc.json",
  stations: "public/config/stations.json",
  uldSpecs: "public/config/uld-specs.json",
  weather: "public/data/weather/DXB.json",
  geofence: "public/data/airports/DXB.geojson",
  airports: "public/data/airports.json",
  flights: "public/data/flights.json",
  shipments: "public/data/shipments.json",
  uldInventory: "public/data/uld-inventory.json",
  iotDevices: "public/data/iot-devices.json",
  dgDeclarations: "public/data/dg-declarations.json",
  scenarios: "public/data/scenarios.json",
} as const;

const ALLOWED_SHC = ["AVI", "PER", "COL", "CRT", "FRO", "HEG"] as const;
const REQUIRED_SENSOR_TYPES = [
  "TEMPERATURE",
  "HUMIDITY",
  "GPS",
  "SHOCK",
] as const;

type Json = unknown;

const loadJson = (relPath: string): Json => {
  const abs = path.join(ROOT, relPath);
  const raw = readFileSync(abs, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse JSON at ${relPath}: ${(err as Error).message}`,
    );
  }
};

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

type ShcConfig = {
  shc: Record<string, unknown>;
  default: unknown;
};

type Flight = { "@id": string; "@type": string; flightNumber: string };

type Piece = {
  "@id": string;
  "@type": "Piece";
  grossWeight: { value: number; unit: string };
  ofShipment: string;
  dgDeclaration?: string;
  temperatureInstructions?: { "@id": string; "@type": string };
};

type Waybill = {
  "@id": string;
  "@type": "Waybill";
  waybillPrefix: string;
  waybillNumber: string;
  shc: string;
  pieces: Piece[];
};

type ShipmentsFile = Record<string, Waybill[]>;

type Uld = {
  "@id": string;
  "@type": "ULD";
  uldSerialNumber: string;
  uldProductCode: string;
  iotDeviceId?: string;
};

type IotSensor = {
  "@id": string;
  "@type": "Sensor";
  sensorType: string;
  serialNumber: string;
};

type IotDevice = {
  "@id": string;
  "@type": "IotDevice";
  serialNumber: string;
  attachedTo: string;
  sensors: IotSensor[];
};

type DgDeclaration = {
  "@id": string;
  "@type": "DgDeclaration";
  issuedForPiece: string;
  declarationPlace: string;
  departureLocation: string;
  arrivalLocation: string;
};

type GeofenceFeature = {
  type: "Feature";
  id: string;
  properties: Record<string, unknown>;
  geometry: { type: string };
};

type GeofenceFile = {
  type: "FeatureCollection";
  features: GeofenceFeature[];
};

const requireBaseId = (obj: unknown, label: string) => {
  if (!obj || typeof obj !== "object") {
    fail(`${label}: not an object`);
    return;
  }
  const o = obj as Record<string, unknown>;
  if (typeof o["@id"] !== "string" || o["@id"].length === 0) {
    fail(`${label}: missing @id`);
  }
  if (typeof o["@type"] !== "string" || o["@type"].length === 0) {
    fail(`${label}: missing @type`);
  }
};

// ---------- Load fixtures ----------

const shcConfig = loadJson(FIXTURE_PATHS.shc) as ShcConfig;
const uldSpecs = loadJson(FIXTURE_PATHS.uldSpecs) as Record<string, unknown>;
const flights = loadJson(FIXTURE_PATHS.flights) as Flight[];
const shipments = loadJson(FIXTURE_PATHS.shipments) as ShipmentsFile;
const uldInventory = loadJson(FIXTURE_PATHS.uldInventory) as Uld[];
const iotDevices = loadJson(FIXTURE_PATHS.iotDevices) as IotDevice[];
const dgDeclarations = loadJson(FIXTURE_PATHS.dgDeclarations) as Record<
  string,
  DgDeclaration
>;
const geofence = loadJson(FIXTURE_PATHS.geofence) as GeofenceFile;
const scenariosRaw = loadJson(FIXTURE_PATHS.scenarios);

// Static existence checks (loaded but their shape is unconstrained for M2)
loadJson(FIXTURE_PATHS.stations);
loadJson(FIXTURE_PATHS.weather);
loadJson(FIXTURE_PATHS.airports);

// ---------- Scenario schema (Zod) ----------

const scenariosParsed = scenariosFileSchema.safeParse(scenariosRaw);
if (!scenariosParsed.success) {
  fail(
    `scenarios.json: failed Zod schema validation:\n${scenariosParsed.error.issues
      .map((i) => `    ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n")}`,
  );
}
const scenarios = scenariosParsed.success ? scenariosParsed.data.scenarios : [];

// ---------- Quick sanity: all entities have @id / @type ----------

flights.forEach((f, i) => requireBaseId(f, `flights[${i}]`));
uldInventory.forEach((u, i) => requireBaseId(u, `uld-inventory[${i}]`));
iotDevices.forEach((d, i) => {
  requireBaseId(d, `iot-devices[${i}]`);
  d.sensors?.forEach((s, j) =>
    requireBaseId(s, `iot-devices[${i}].sensors[${j}]`),
  );
});
Object.entries(dgDeclarations).forEach(([key, d]) => {
  requireBaseId(d, `dg-declarations[${key}]`);
});
Object.values(shipments)
  .flat()
  .forEach((wb, i) => {
    requireBaseId(wb, `shipments[*][${i}]`);
    wb.pieces?.forEach((p, j) =>
      requireBaseId(p, `shipments[*][${i}].pieces[${j}]`),
    );
  });

// ---------- Build lookup tables ----------

const flightSet = new Set(flights.map((f) => f.flightNumber));
const uldSet = new Set(uldInventory.map((u) => u.uldSerialNumber));
const uldByIri = new Map(uldInventory.map((u) => [u["@id"], u]));
const iotDeviceById = new Map(
  iotDevices.map((d) => [d.serialNumber, d] as const),
);
const dgDeclarationIris = new Set(Object.keys(dgDeclarations));
const uldProductCodes = new Set(Object.keys(uldSpecs));
const allowedShcSet = new Set(ALLOWED_SHC);
const shcKeysFromConfig = new Set(Object.keys(shcConfig.shc));

// ---------- Validation rules ----------

// Rule 1: every flight referenced by ≥1 scenario OR is sandbox EK0357
const sandboxFlight = "EK0357";
const referencedFlights = new Set<string>();
scenarios.forEach((s) =>
  s.initial_state?.flights?.forEach((fno) => referencedFlights.add(fno)),
);
flights.forEach((f) => {
  if (
    !referencedFlights.has(f.flightNumber) &&
    f.flightNumber !== sandboxFlight
  ) {
    fail(
      `Rule 1: flight ${f.flightNumber} not referenced by any scenario and is not the sandbox flight (${sandboxFlight})`,
    );
  }
});

// Rule 2: every AWB lives under exactly one flightNumber key
{
  const awbCounts = new Map<string, string[]>();
  Object.entries(shipments).forEach(([flightNo, wbs]) => {
    wbs.forEach((wb) => {
      const awb = `${wb.waybillPrefix}-${wb.waybillNumber}`;
      const list = awbCounts.get(awb) ?? [];
      list.push(flightNo);
      awbCounts.set(awb, list);
    });
  });
  awbCounts.forEach((flightList, awb) => {
    if (flightList.length !== 1) {
      fail(
        `Rule 2: AWB ${awb} appears under multiple flightNumber keys: [${flightList.join(", ")}]`,
      );
    }
  });
}

// Rule 3 & 4: ULD iotDeviceId either matches an iot-devices entry, or is absent (passive)
uldInventory.forEach((u) => {
  if (u.iotDeviceId === undefined) return; // passive — fine
  if (!iotDeviceById.has(u.iotDeviceId)) {
    fail(
      `Rule 3: ULD ${u.uldSerialNumber} references iotDeviceId ${u.iotDeviceId}, which has no entry in iot-devices.json`,
    );
    return;
  }
  // Rule 4: the device exists; must have 4 sensors of the required types
  const dev = iotDeviceById.get(u.iotDeviceId)!;
  if (dev.sensors.length !== 4) {
    fail(
      `Rule 4: IoT device ${dev.serialNumber} has ${dev.sensors.length} sensors; expected 4`,
    );
  }
  const sensorTypes = new Set(dev.sensors.map((s) => s.sensorType));
  REQUIRED_SENSOR_TYPES.forEach((t) => {
    if (!sensorTypes.has(t)) {
      fail(
        `Rule 4: IoT device ${dev.serialNumber} missing required sensor type ${t}`,
      );
    }
  });
});

// Rule 5: every uldProductCode exists in uld-specs.json
uldInventory.forEach((u) => {
  if (!uldProductCodes.has(u.uldProductCode)) {
    fail(
      `Rule 5: ULD ${u.uldSerialNumber} uldProductCode ${u.uldProductCode} not present in uld-specs.json`,
    );
  }
});

// Rule 6: every non-empty SHC code on AWBs is one of AVI|PER|COL|CRT|FRO|HEG
Object.values(shipments)
  .flat()
  .forEach((wb) => {
    if (wb.shc === "" || wb.shc === undefined || wb.shc === null) return;
    if (!allowedShcSet.has(wb.shc as (typeof ALLOWED_SHC)[number])) {
      fail(
        `Rule 6: AWB ${wb.waybillPrefix}-${wb.waybillNumber} carries SHC ${wb.shc}; not in allowed set [${ALLOWED_SHC.join(", ")}]`,
      );
    }
    if (!shcKeysFromConfig.has(wb.shc)) {
      fail(
        `Rule 6: AWB ${wb.waybillPrefix}-${wb.waybillNumber} SHC ${wb.shc} is not declared in shc.json`,
      );
    }
  });

// Rule 7: every DG-declared piece carries a dgDeclaration IRI that resolves
const allPieces = Object.values(shipments)
  .flat()
  .flatMap((wb) => wb.pieces);
allPieces.forEach((p) => {
  if (!p.dgDeclaration) return;
  if (!dgDeclarationIris.has(p.dgDeclaration)) {
    fail(
      `Rule 7: piece ${p["@id"]} dgDeclaration ${p.dgDeclaration} does not resolve in dg-declarations.json`,
    );
  }
});

// Rule 8: every geofence feature has a referenceAmbientDeltaC property (null allowed for runway)
if (geofence.type !== "FeatureCollection") {
  fail(`Rule 8: DXB.geojson is not a FeatureCollection`);
}
if (geofence.features.length !== 8) {
  fail(
    `Rule 8: DXB.geojson has ${geofence.features.length} features; expected 8`,
  );
}
geofence.features.forEach((feat) => {
  const hasProperty =
    feat.properties && "referenceAmbientDeltaC" in feat.properties;
  if (!hasProperty) {
    fail(
      `Rule 8: geofence feature ${feat.id} missing referenceAmbientDeltaC property`,
    );
    return;
  }
  const value = feat.properties.referenceAmbientDeltaC;
  if (value !== null && typeof value !== "number") {
    fail(
      `Rule 8: geofence feature ${feat.id} referenceAmbientDeltaC is ${typeof value}; expected number or null`,
    );
  }
});

// Rule 9: scenario initial_state.flights and ulds reference real fixture entities
scenarios.forEach((s) => {
  s.initial_state?.flights?.forEach((fno) => {
    if (!flightSet.has(fno)) {
      fail(
        `Rule 9: scenario ${s.id} initial_state.flights references unknown flight ${fno}`,
      );
    }
  });
  s.initial_state?.ulds?.forEach((uldId) => {
    if (!uldSet.has(uldId)) {
      fail(
        `Rule 9: scenario ${s.id} initial_state.ulds references unknown ULD ${uldId}`,
      );
    }
  });
});

// Rule 10: scenario events[].uldId references existing ULD
scenarios.forEach((s) => {
  s.events?.forEach((evt, i) => {
    const uldId = (evt as Record<string, unknown>).uldId;
    if (typeof uldId === "string" && !uldSet.has(uldId)) {
      fail(
        `Rule 10: scenario ${s.id} events[${i}] references unknown uldId ${uldId}`,
      );
    }
  });
});

// Rule 11: at least one of each SHC code present across shipments.json
{
  const seen = new Set<string>();
  Object.values(shipments)
    .flat()
    .forEach((wb) => {
      if (wb.shc) seen.add(wb.shc);
    });
  ALLOWED_SHC.forEach((code) => {
    if (!seen.has(code)) {
      fail(`Rule 11: no AWB carries SHC ${code} — full SHC coverage failed`);
    }
  });
}

// Rule 12: at least one DG-declared AWB present
{
  const dgAwbs = new Set<string>();
  Object.values(shipments)
    .flat()
    .forEach((wb) => {
      if (wb.pieces.some((p) => p.dgDeclaration)) {
        dgAwbs.add(`${wb.waybillPrefix}-${wb.waybillNumber}`);
      }
    });
  if (dgAwbs.size < 1) {
    fail(`Rule 12: no DG-declared AWB present — DG path coverage failed`);
  }
}

// Rule 13: tracker-equipped + passive ULDs both present
{
  const trackerCount = uldInventory.filter(
    (u) => typeof u.iotDeviceId === "string",
  ).length;
  const passiveCount = uldInventory.filter(
    (u) => u.iotDeviceId === undefined,
  ).length;
  if (trackerCount < 1) {
    fail(`Rule 13: no tracker-equipped ULDs in inventory`);
  }
  if (passiveCount < 1) {
    fail(`Rule 13: no passive ULDs in inventory`);
  }
}

// ---------- Cross-check: every iot-devices.attachedTo points at a real ULD ----------

iotDevices.forEach((d) => {
  if (!uldByIri.has(d.attachedTo)) {
    fail(
      `IoT device ${d.serialNumber} attachedTo ${d.attachedTo} does not resolve to a ULD`,
    );
  }
});

// ---------- Header counts (informational + asserted) ----------

const expected = {
  flights: 4,
  awbs: 13,
  ulds: 12,
  trackerUlds: 7,
  passiveUlds: 5,
  iotDevices: 7,
  sensors: 28,
  geofenceFeatures: 8,
  dgDeclarations: 2,
  scenarios: 4,
};

const actualCounts = {
  flights: flights.length,
  awbs: Object.values(shipments).flat().length,
  ulds: uldInventory.length,
  trackerUlds: uldInventory.filter((u) => u.iotDeviceId).length,
  passiveUlds: uldInventory.filter((u) => !u.iotDeviceId).length,
  iotDevices: iotDevices.length,
  sensors: iotDevices.reduce((acc, d) => acc + d.sensors.length, 0),
  geofenceFeatures: geofence.features.length,
  dgDeclarations: Object.keys(dgDeclarations).length,
  scenarios: scenarios.length,
};

(Object.keys(expected) as Array<keyof typeof expected>).forEach((k) => {
  if (expected[k] !== actualCounts[k]) {
    fail(
      `Count mismatch for ${k}: expected ${expected[k]}, got ${actualCounts[k]}`,
    );
  }
});

// ---------- Output ----------

if (errors.length > 0) {
  console.error("\n❌ validate-fixtures failed:\n");
  errors.forEach((e) => console.error(`  • ${e}`));
  console.error(`\n${errors.length} error(s)\n`);
  process.exit(1);
}

console.log("✅ validate-fixtures: all checks passed");
console.log("  Counts:");
(Object.keys(actualCounts) as Array<keyof typeof actualCounts>).forEach((k) => {
  console.log(`    ${k}: ${actualCounts[k]}`);
});
console.log(`  Scenarios: ${scenarios.map((s) => s.id).join(", ")}`);
console.log(
  `  SHC coverage: ${[
    ...new Set(
      Object.values(shipments)
        .flat()
        .map((w) => w.shc)
        .filter(Boolean),
    ),
  ]
    .sort()
    .join(", ")}`,
);
process.exit(0);
