# Mock Data Plan — Cool-Chain Copilot

Concrete fixtures backing every scenario in **PLAN.md → Demo Control Panel** and **PLAN.md → Demo Scenario**. All fixtures normalised to **IATA ONE Record v3.2** shapes (see PLAN.md → **Data Models**). Adapter pattern means everything here is the in-house mock; future real-API swap is one adapter file (PLAN.md → **API route adapter layer**).

> **Source of truth**: this file. JSON fixtures listed below MUST satisfy the cross-reference matrix in this doc. Any new scenario or new fixture entry must update this doc first, then propagate.

## Plan Revisions

| Rev | Date       | Author | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0 | 2026-04-25 | Lead   | Initial mock data plan — 4 flights, 13 AWBs (COL/PER/AVI/CRT/FRO/HEG mix, 2 DG-declared placeholders), 12 ULDs (7 with integrated trackers, 5 passive), DXB geofence with 8 sub-zones, station capabilities, weather curve. Cross-reference matrix tying every fixture to its scenario. DGD mapping deferred — placeholder schema until user provides DGD docs.                                                                                                                                                            |
| 1.1 | 2026-04-25 | Lead   | Cohesion review fixes: AKH ULDs now reference `AKH_HORSE_STALL` product code (not Generic passive). New `ENVIROTAINER_RKN_FRO` product spec added; RKN-99002EK retyped to FRO so 176-13579246 (frozen lobster) has a compatible ULD. AWB → ULD compatibility map added under Cross-fixture invariants. Cascading-delays scenario row updated with new ULDs (AKH-77702EK, RKN-99002EK) and clarification that AVI fish + FRO ULDs are passive (inferred state).                                                             |
| 1.2 | 2026-04-25 | Lead   | DG AutoCheck Connect API spec received. DG mapping section reframed: stub fixtures now described as the post-AutoCheck cache shape (what the adapter would have stored after a passed webhook). Two operating modes documented (stub vs real). Swap surface enumerated for M23 (autocheck client, webhook listener, env vars). Canonical `:DgDeclaration` shape preserved.                                                                                                                                                 |
| 1.3 | 2026-04-25 | Lead   | Extended `:DgDeclaration` stub fixtures to cover every IATA Shipper's Declaration (DGD) form field. Added shipper/consignee/issuer/signatory party graph, `dgDeclaredItems[]` (UN id, proper shipping name, class, packing group, packaging type, number of packages, net quantity, PI, authorization), shipment limitation enum, shipment type, handling information. Removed `_placeholder` flag — shape is now form-complete; M23 maps XSDG export fields onto this canonical shape rather than extending schema again. |

## Files covered

| Path                               | Purpose                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `public/data/flights.json`         | `:TransportMovement[]` — today's outbound at DXB                                                                      |
| `public/data/shipments.json`       | AWBs (`:Waybill[]`) keyed by `flightNumber`, with `:Piece[]` + `:TemperatureInstructions` + optional `:DgDeclaration` |
| `public/data/uld-inventory.json`   | Available ULDs (`:ULD[]`) at DXB, with optional `iotDeviceId` + sensor list                                           |
| `public/data/iot-devices.json`     | `:IotDevice[]` and `:Sensor[]` for trackers attached to ULDs                                                          |
| `public/config/uld-specs.json`     | PCM autonomy curves per ULD product type (Envirotainer, va-Q-tainer, Sonoco, generic)                                 |
| `public/config/stations.json`      | DXB capability registry (cool dollies, cool-room slots, build-up bays, GPU policy, CEIV)                              |
| `public/config/shc.json`           | SHC tolerance database — see PLAN.md → **SHC Config**                                                                 |
| `public/data/airports/DXB.geojson` | Geofence sub-zones inside DXB airport polygon                                                                         |
| `public/data/weather/DXB.json`     | Pre-baked ambient curve fallback for Open-Meteo                                                                       |
| `public/data/scenarios.json`       | Scripted timelines — see PLAN.md → **Demo Control Panel**                                                             |

## Entity ID conventions

- AWB: `<carrier-prefix>-<8-digit>` — e.g. `176-12345678`
- ULD: `<3-letter-type>-<5-digit><owner>` — e.g. `AKE-12345EK`
- Flight: `<carrier><4-digit>` — e.g. `EK0083`
- IoT device: `IOT-<3-digit>` — e.g. `IOT-001`
- Sensor: `<deviceId>-<sensorType>` — e.g. `IOT-001-TEMP`
- IRI scheme: `urn:cargo:<type>:<id>` — e.g. `urn:cargo:uld:AKE-12345EK`. Adapter generates these from raw IDs.

---

## Flights (`flights.json`)

Four DXB outbound flights. Three drive scripted scenarios; the fourth is sandbox-only breadth.

| Flight     | Route     | ETD (local) | Aircraft body | Used in scenarios                                         |
| ---------- | --------- | ----------- | ------------- | --------------------------------------------------------- |
| **EK0083** | DXB → FRA | 14:20       | Wide-body     | dxb-warehouse-demo, dxb-quiet-shift, dxb-cascading-delays |
| **EK0237** | DXB → LHR | 14:50       | Wide-body     | dxb-cascading-delays                                      |
| **EK0411** | DXB → JFK | 15:30       | Wide-body     | dxb-cascading-delays                                      |
| **EK0357** | DXB → SIN | 16:00       | Wide-body     | custom (sandbox only)                                     |

**Sample shape** (`:TransportMovement`):

```json
{
  "@id": "urn:cargo:flight:EK0083",
  "@type": "TransportMovement",
  "modeCode": "Air",
  "flightNumber": "EK0083",
  "departureLocation": "urn:cargo:loc:DXB",
  "arrivalLocation": "urn:cargo:loc:FRA",
  "movementTimes": [
    { "type": "STD", "timestamp": "2026-04-25T14:20:00+04:00" },
    { "type": "STA", "timestamp": "2026-04-25T19:05:00+02:00" }
  ],
  "operatingParties": ["urn:cargo:carrier:EK"],
  "loadingActions": []
}
```

`loadingActions` populates as ULDs get built up during scenarios.

---

## Shipments / AWBs (`shipments.json`)

13 AWBs across 4 flights. SHC mix: 3 COL, 2 PER, 2 AVI, 3 CRT, 1 FRO, 1 HEG, 2 DG-declared. Both DG-declared AWBs carry a `:DgDeclaration` IRI on each piece, with the actual `DgDeclaration` payload loaded from `dg-declarations.json` (see **DG mapping placeholder** below).

### EK0083 (DXB → FRA) — 4 AWBs

| AWB          | SHC | Description                  | Pieces | Gross  | Temp range | DG                                          | Used in                                  |
| ------------ | --- | ---------------------------- | ------ | ------ | ---------- | ------------------------------------------- | ---------------------------------------- |
| 176-12345678 | COL | Pharma vaccines, PharmaCo    | 4      | 142 kg | 2–8°C      | —                                           | dxb-warehouse-demo, dxb-quiet-shift      |
| 176-23456789 | PER | Fresh roses, FloraEx         | 2      | 89 kg  | 2–8°C      | —                                           | dxb-warehouse-demo, dxb-cascading-delays |
| 176-34567890 | AVI | Live racehorses, StallionAir | 1      | 920 kg | 18–26°C    | —                                           | dxb-cascading-delays                     |
| 176-45678901 | CRT | Smartphones, TechShip        | 8      | 425 kg | 15–25°C    | **Class 9 (lithium-ion batteries, UN3481)** | dxb-cascading-delays                     |

### EK0237 (DXB → LHR) — 4 AWBs

| AWB          | SHC         | Description                      | Pieces | Gross   | Temp range | DG                              | Used in              |
| ------------ | ----------- | -------------------------------- | ------ | ------- | ---------- | ------------------------------- | -------------------- |
| 176-56789012 | PER         | Fresh tuna, OceanCargo           | 6      | 1240 kg | 2–8°C      | —                               | dxb-cascading-delays |
| 176-67890123 | COL         | Biologics, BioMed                | 2      | 78 kg   | 2–8°C      | —                               | dxb-cascading-delays |
| 176-78901234 | CRT         | Consumer goods, mixed            | 12     | 890 kg  | 15–25°C    | —                               | dxb-cascading-delays |
| 176-89012345 | — (general) | Corrosive substance, ChemFreight | 3      | 145 kg  | ambient    | **Class 8 (corrosive, UN1789)** | custom               |

### EK0411 (DXB → JFK) — 3 AWBs

| AWB          | SHC | Description                    | Pieces | Gross  | Temp range   | DG  | Used in              |
| ------------ | --- | ------------------------------ | ------ | ------ | ------------ | --- | -------------------- |
| 176-90123456 | AVI | Live ornamental fish, AquaShip | 4      | 320 kg | 22–26°C      | —   | dxb-cascading-delays |
| 176-01234567 | COL | Antibiotics, PharmaWorld       | 5      | 234 kg | 2–8°C        | —   | dxb-cascading-delays |
| 176-13579246 | FRO | Frozen lobster, PolarLog       | 3      | 540 kg | -25 to -15°C | —   | dxb-cascading-delays |

### EK0357 (DXB → SIN) — 2 AWBs (sandbox-only)

| AWB          | SHC | Description                            | Pieces | Gross  | Temp range | DG  | Used in |
| ------------ | --- | -------------------------------------- | ------ | ------ | ---------- | --- | ------- |
| 176-24681357 | HEG | Fertile hatching eggs, Poultry Express | 6      | 88 kg  | 18–22°C    | —   | custom  |
| 176-86420975 | CRT | Mixed consumer goods                   | 4      | 156 kg | 15–25°C    | —   | custom  |

### Sample AWB shape (`:Waybill` + `:Piece` + `:TemperatureInstructions`)

```json
{
  "@id": "urn:cargo:waybill:176-12345678",
  "@type": "Waybill",
  "waybillPrefix": "176",
  "waybillNumber": "12345678",
  "departureLocation": "urn:cargo:loc:DXB",
  "arrivalLocation": "urn:cargo:loc:FRA",
  "shc": "COL",
  "declaredValueForCarriage": { "value": 850000, "currency": "USD" },
  "pieces": [
    {
      "@id": "urn:cargo:piece:176-12345678-1",
      "@type": "Piece",
      "grossWeight": { "value": 36, "unit": "kg" },
      "dimensions": { "length": 60, "width": 40, "height": 35, "unit": "cm" },
      "ofShipment": "urn:cargo:waybill:176-12345678",
      "temperatureInstructions": {
        "@id": "urn:cargo:tempinstr:176-12345678-1",
        "@type": "TemperatureInstructions",
        "minTemperature": { "value": 2, "unit": "C" },
        "maxTemperature": { "value": 8, "unit": "C" }
      }
    }
  ]
}
```

DG-declared pieces additionally carry `dgDeclaration: "urn:cargo:dgdec:..."` linking into `dg-declarations.json`.

---

## ULD Inventory (`uld-inventory.json`)

12 ULDs at DXB. **7 with integrated trackers, 5 passive (no tracker).** Passive ULD telemetry is _inferred_ from station polygon ambient + last-known-state + physics extrapolation rather than measured directly; UI surfaces a `tracker: 'integrated' | 'inferred'` badge so judges immediately see the difference.

| ULD         | Type                 | Product              | Owner | Tracker     | Pre-cool  | Used in                                                      |
| ----------- | -------------------- | -------------------- | ----- | ----------- | --------- | ------------------------------------------------------------ |
| AKE-12345EK | AKE (LD-3)           | Envirotainer RAP-COL | EK    | **IOT-001** | 4.2°C ✅  | dxb-warehouse-demo                                           |
| AKE-22219EK | AKE (LD-3)           | Envirotainer RAP-COL | EK    | **IOT-002** | 4.5°C ✅  | dxb-cascading-delays                                         |
| AKE-33310EK | AKE (LD-3)           | Generic passive      | EK    | —           | ambient   | available                                                    |
| RKN-99001EK | RKN (reefer)         | va-Q-tainer XL       | EK    | **IOT-003** | 5.1°C ✅  | dxb-quiet-shift, dxb-cascading-delays                        |
| RKN-99002EK | RKN (reefer)         | Envirotainer RKN-FRO | EK    | —           | -19°C ✅  | available (FRO frozen lobster fallback for cascading-delays) |
| AKH-77701EK | AKH (horse stall)    | AKH horse stall      | EK    | **IOT-004** | ambient   | dxb-cascading-delays (AVI horses)                            |
| AKH-77702EK | AKH (horse stall)    | AKH horse stall      | EK    | —           | ambient   | available (AVI fish fallback for cascading-delays)           |
| PMC-10001EK | PMC (main-deck)      | Generic passive      | EK    | **IOT-005** | ambient   | available                                                    |
| PMC-10002EK | PMC (main-deck)      | Generic passive      | EK    | —           | ambient   | available                                                    |
| AAU-66610EK | AAU (contoured)      | Sonoco Pegasus CRT   | EK    | **IOT-006** | 21.8°C ✅ | dxb-cascading-delays (CRT)                                   |
| AAY-55501EK | AAY (thermal pallet) | Generic passive      | EK    | —           | ambient   | available                                                    |
| AKW-44401EK | AKW (cold LD-3)      | Envirotainer RAP-COL | EK    | **IOT-007** | 4.0°C ✅  | available                                                    |

### Sample ULD shape (`:ULD`)

```json
{
  "@id": "urn:cargo:uld:AKE-12345EK",
  "@type": "ULD",
  "uldSerialNumber": "AKE-12345EK",
  "uldTypeCode": "AKE",
  "ataDesignator": "AKE",
  "serviceabilityCode": "SER",
  "damageFlag": false,
  "ownerCode": "EK",
  "numberOfDoors": 1,
  "loadingIndicator": "Y",
  "uldProductCode": "ENVIROTAINER_RAP_COL",
  "iotDeviceId": "IOT-001",
  "lastKnownInternalC": 4.2,
  "lastKnownLocation": "urn:cargo:zone:DXB-cool-room"
}
```

Passive ULDs omit `iotDeviceId` and `lastKnownInternalC`; the inference engine (PLAN.md → **State Inference**) bootstraps initial internal temp from the polygon's ambient + product spec.

---

## IoT Devices & Sensors (`iot-devices.json`)

7 IoT devices, each with 4 sensors (TEMPERATURE, HUMIDITY, GPS, SHOCK). Measurements stream from the **Tracker simulator** (PLAN.md → **Subsystem 4** in old plan, replaced by simulator milestone M8). Passive ULDs have no IoT device — their state is inferred.

### Sample IoT device + sensors shape

```json
{
  "@id": "urn:cargo:iot:IOT-001",
  "@type": "IotDevice",
  "serialNumber": "IOT-001",
  "attachedTo": "urn:cargo:uld:AKE-12345EK",
  "sensors": [
    {
      "@id": "urn:cargo:sensor:IOT-001-TEMP",
      "@type": "Sensor",
      "sensorType": "TEMPERATURE",
      "serialNumber": "IOT-001-TEMP",
      "partOfIotDevice": "urn:cargo:iot:IOT-001"
    },
    {
      "@id": "urn:cargo:sensor:IOT-001-HUM",
      "@type": "Sensor",
      "sensorType": "HUMIDITY",
      "serialNumber": "IOT-001-HUM",
      "partOfIotDevice": "urn:cargo:iot:IOT-001"
    },
    {
      "@id": "urn:cargo:sensor:IOT-001-GPS",
      "@type": "Sensor",
      "sensorType": "GPS",
      "serialNumber": "IOT-001-GPS",
      "partOfIotDevice": "urn:cargo:iot:IOT-001"
    },
    {
      "@id": "urn:cargo:sensor:IOT-001-SHOCK",
      "@type": "Sensor",
      "sensorType": "SHOCK",
      "serialNumber": "IOT-001-SHOCK",
      "partOfIotDevice": "urn:cargo:iot:IOT-001"
    }
  ]
}
```

---

## ULD Product Specs (`uld-specs.json`)

PCM autonomy parameters per ULD product. Inputs to the physics engine (M4).

| Product code           | k (heat-transfer coeff) | PCM melt range | Max acceptable internal | Rated autonomy at 25°C ambient | Notes                             |
| ---------------------- | ----------------------- | -------------- | ----------------------- | ------------------------------ | --------------------------------- |
| `ENVIROTAINER_RAP_COL` | 0.05                    | 4–7°C          | 8°C                     | 96 h                           | COL pharma reefer                 |
| `VA_Q_TAINER_XL`       | 0.03                    | 5–8°C          | 8°C                     | 120 h                          | High-end pharma                   |
| `SONOCO_PEGASUS_CRT`   | 0.06                    | 18–22°C        | 25°C                    | 80 h                           | CRT controlled-room               |
| `ENVIROTAINER_RKN_FRO` | 0.04                    | -22°C to -18°C | -15°C                   | 72 h                           | Frozen reefer (-20°C nominal)     |
| `GENERIC_PASSIVE`      | 0.10                    | none           | depends on SHC          | 12 h                           | No PCM; ambient delta only        |
| `AKH_HORSE_STALL`      | 0.12                    | none           | 26°C                    | 8 h                            | Live animal (large), ambient only |

Pegasus CRT's max-acceptable threshold (25°C) is loose since CRT is a wider window; physics still triggers a yellow warning at 23°C buffer.

---

## Airport coordinates

Used by the map (PLAN.md → **Map / Geo Visualisation**) and the tracker simulator's great-circle in-flight interpolation.

| Airport             | IATA    | lat     | lon      | Role                                |
| ------------------- | ------- | ------- | -------- | ----------------------------------- |
| Dubai International | **DXB** | 25.2532 | 55.3657  | Origin (only station for hackathon) |
| Frankfurt am Main   | FRA     | 50.0379 | 8.5622   | Arrival — EK0083                    |
| London Heathrow     | LHR     | 51.4700 | -0.4543  | Arrival — EK0237                    |
| New York JFK        | JFK     | 40.6413 | -73.7781 | Arrival — EK0411                    |
| Singapore Changi    | SIN     | 1.3644  | 103.9915 | Arrival — EK0357 (sandbox)          |

Coordinates ship as `:Location` with attached `:Geolocation` records — IRIs follow `urn:cargo:loc:<IATA>` (e.g. `urn:cargo:loc:DXB`). Adapter loads from `public/data/airports.json` (mirror of this table).

```json
{
  "DXB": {
    "iata": "DXB",
    "latitude": 25.2532,
    "longitude": 55.3657,
    "tzOffsetMinutes": 240
  },
  "FRA": {
    "iata": "FRA",
    "latitude": 50.0379,
    "longitude": 8.5622,
    "tzOffsetMinutes": 120
  },
  "LHR": {
    "iata": "LHR",
    "latitude": 51.47,
    "longitude": -0.4543,
    "tzOffsetMinutes": 60
  },
  "JFK": {
    "iata": "JFK",
    "latitude": 40.6413,
    "longitude": -73.7781,
    "tzOffsetMinutes": -240
  },
  "SIN": {
    "iata": "SIN",
    "latitude": 1.3644,
    "longitude": 103.9915,
    "tzOffsetMinutes": 480
  }
}
```

---

## DXB Geofence (`airports/DXB.geojson`)

Eight named features inside DXB airport bounds. Used by state classifier (M5) and ULD detail map (M14).

| Feature ID                | Type       | Approx centre (lat, lon)            | Purpose                              | Reference ambient                  |
| ------------------------- | ---------- | ----------------------------------- | ------------------------------------ | ---------------------------------- |
| `cool-room`               | Polygon    | 25.2461, 55.3585                    | Cargo Mega Terminal cool zone        | 5°C                                |
| `build-up-area`           | Polygon    | 25.2470, 55.3597                    | Build-up bays floor                  | 22°C                               |
| `apron-staging-1`         | Polygon    | 25.2440, 55.3500                    | Apron staging near terminal          | tarmac ambient                     |
| `apron-staging-2`         | Polygon    | 25.2450, 55.3520                    | Apron staging far west               | tarmac ambient                     |
| `tarmac-shadow-jetbridge` | Polygon    | 25.2510, 55.3625                    | Shadow zone near gate B12 jet bridge | tarmac ambient – 4°C               |
| `tarmac-shadow-tail`      | Polygon    | 25.2515, 55.3635                    | Shadow zone near gate B14 tail       | tarmac ambient – 3°C               |
| `gate-A12`                | Polygon    | 25.2525, 55.3650                    | Active loading position gate A12     | tarmac ambient                     |
| `runway-25R`              | LineString | 25.2480, 55.3540 → 25.2400, 55.3700 | Departure runway centreline          | n/a (in-flight transition trigger) |

Polygons are ~50–150 m on a side, drawn as small rectangles around each centre. Approximate; not survey-grade. GeoJSON feature properties include `referenceAmbientDeltaC` (vs station ambient) so the inference engine can compute zone-specific ambient without re-deriving, plus `name` and `purpose` for the UI legend.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "cool-room",
      "properties": {
        "name": "Cool Room",
        "purpose": "Cargo Mega Terminal cool zone",
        "referenceAmbientC": 5,
        "referenceAmbientDeltaC": null
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [55.358, 25.2458],
            [55.359, 25.2458],
            [55.359, 25.2464],
            [55.358, 25.2464],
            [55.358, 25.2458]
          ]
        ]
      }
    }
  ]
}
```

`build-up-area` is also where the build-up canvas (M13) "performedAt" field for the `:Loading` action references.

---

## Stations (`stations.json`)

Single-station: DXB. Capabilities used by the action recommender (M6) for filtering.

```json
{
  "DXB": {
    "iata": "DXB",
    "name": "Dubai International",
    "ceivCertified": true,
    "resources": {
      "coolDolliesTotal": 8,
      "coolRoomSlotsTotal": 200,
      "buildupBaysTotal": 4,
      "breakdownBaysTotal": 0
    },
    "policies": {
      "gpu": "available-on-request",
      "shadingZones": ["tarmac-shadow-jetbridge", "tarmac-shadow-tail"],
      "thermalBlanketStock": "Y",
      "wetRagAuthorised": "Y"
    },
    "operatingHours": "24x7"
  }
}
```

Mock real-time resource availability (free counters) lives in `sessionStorage` via `resources-store.ts` (M19). Initial values seeded from each scenario's `initial_state.resources`.

---

## Weather (`weather/DXB.json`)

Pre-baked fallback for Open-Meteo. 24-hour ambient curve in 1-hour steps. Summer afternoon profile peaking 42°C at 14:00, dropping to 28°C overnight. Humidity 55–80% inverse-correlated to temp.

```json
{
  "airport": "DXB",
  "source": "mock",
  "generatedAt": "2026-04-25T00:00:00+04:00",
  "hourly": [
    {
      "timestamp": "2026-04-25T00:00:00+04:00",
      "ambientC": 30,
      "humidityPct": 70,
      "cloudCoverPct": 20
    },
    {
      "timestamp": "2026-04-25T06:00:00+04:00",
      "ambientC": 28,
      "humidityPct": 75,
      "cloudCoverPct": 30
    },
    {
      "timestamp": "2026-04-25T12:00:00+04:00",
      "ambientC": 40,
      "humidityPct": 55,
      "cloudCoverPct": 25
    },
    {
      "timestamp": "2026-04-25T14:00:00+04:00",
      "ambientC": 42,
      "humidityPct": 50,
      "cloudCoverPct": 20
    },
    {
      "timestamp": "2026-04-25T18:00:00+04:00",
      "ambientC": 38,
      "humidityPct": 60,
      "cloudCoverPct": 35
    },
    {
      "timestamp": "2026-04-25T22:00:00+04:00",
      "ambientC": 32,
      "humidityPct": 70,
      "cloudCoverPct": 40
    }
  ]
}
```

Scenario `weather_override` events override this baseline at runtime (PLAN.md → **Demo Control Panel → Event types**).

---

## Scenario Impact Matrix

How each scenario exercises the fixtures. Read top-down to understand which entities to update when changing a scenario; read left-right to find which scenarios depend on a given fixture.

| Scenario                 | Flights touched        | ULDs spawned                                                                 | AWBs in play                                                                                                                                                                  | IoT devices                                                                       | Geofence zones traversed                                     | Weather profile        | Resources at start                 |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | ---------------------------------- |
| **dxb-warehouse-demo** ★ | EK0083                 | AKE-12345EK                                                                  | 176-12345678 (COL), 176-23456789 (PER)                                                                                                                                        | IOT-001                                                                           | cool-room → build-up-area → apron-staging-1                  | 38°C → 42°C ramp       | 2 dollies, 65 cool-room slots      |
| **dxb-quiet-shift**      | EK0083                 | RKN-99001EK                                                                  | 176-12345678 (COL)                                                                                                                                                            | IOT-003                                                                           | cool-room → build-up-area → gate-A12                         | 28°C steady            | 5 dollies, 200 cool-room slots     |
| **dxb-cascading-delays** | EK0083, EK0237, EK0411 | AKE-22219EK, RKN-99001EK, AKH-77701EK, AKH-77702EK, AAU-66610EK, RKN-99002EK | 176-23456789 (PER), 176-56789012 (PER), 176-67890123 (COL), 176-34567890 (AVI horses), 176-45678901 (CRT/DG), 176-90123456 (AVI fish), 176-01234567 (COL), 176-13579246 (FRO) | IOT-002, IOT-003, IOT-004, IOT-006 (fish + FRO ULDs are passive — inferred state) | cool-room → build-up-area → apron-staging-1, apron-staging-2 | 41°C, ramps via delays | 3 dollies, 40 slots, 1 buildup bay |
| **custom** (sandbox)     | any (default EK0357)   | any                                                                          | any (incl. 176-89012345 Class 8 DG, 176-24681357 HEG, 176-86420975 CRT)                                                                                                       | any                                                                               | any                                                          | mock baseline 30°C     | full pool                          |

### Cross-fixture invariants

- **Every AWB used in a scripted scenario must have a temp-compatible ULD.** The inventory split (7 tracker + 5 passive) ensures `dxb-cascading-delays` can showcase both data shapes.
- **AWB → ULD compatibility map** (used by build-up canvas SHC compat checker and the action recommender's ULD-suggestion path):
  - COL pieces → AKE/AKW (Envirotainer RAP-COL) or RKN (va-Q-tainer XL)
  - PER pieces → AKE/AKW or RKN (same 2-8°C window)
  - AVI horses (920 kg, 18-26°C) → AKH (horse stall)
  - AVI ornamental fish (320 kg, 22-26°C) → AKH or AAY (passive thermal pallet)
  - CRT pieces → AAU (Sonoco Pegasus CRT) or PMC/AAY (passive at controlled-room ambient)
  - FRO pieces → RKN-99002EK only (Envirotainer RKN-FRO; the only frozen-capable ULD in inventory)
  - HEG pieces → AKH (live-animal certified) or AAY (passive thermal at 18-22°C)
- **DG-declared AWBs intentionally live outside scripted demos.** `176-45678901` (Class 9 lithium) appears in `dxb-cascading-delays` to demonstrate DG check passing-with-conditions (lithium is allowed under aircraft limitations). `176-89012345` (Class 8 corrosive) lives in sandbox only — designed to reject from any cool-chain ULD.
- **Tracker presence drives UI affordance.** ULD detail (M14) shows "🟢 Live tracker" or "🔵 Inferred" badge; supervisor table (M15) sorts by tracker class as a column option.
- **Geofence reference ambient drives inference confidence.** When ambient sensor reads within ±2°C of a zone's `referenceAmbientDeltaC`, classifier confidence ≥ 0.8; outside, classifier flags ambiguity.
- **Weather baseline is the same file across all scenarios.** Scenarios layer `weather_override` or `weather_ramp` on top — they never edit `weather/DXB.json`.

---

## Build-up flow data effects

Build-up canvas (M13) sign-off **mutates** these fixtures in `sessionStorage` (not on disk):

| On sign-off                                 | Effect on fixture                                              | Stored where                        |
| ------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| ULD becomes "in-build-up" then "built"      | `uld-inventory` mutation: status flag flips                    | `sessionStorage.inventory-store`    |
| AWBs assigned to ULD                        | `shipments` derived map: AWB → ULD IRI                         | `sessionStorage.uld-store.contents` |
| `:Loading` action emitted                   | New record in audit DB `loadings` table                        | IndexedDB via Dexie                 |
| `:LogisticsEvent BUILD_UP_COMPLETE` emitted | New record in audit DB `events` table                          | IndexedDB via Dexie                 |
| Tracker simulator starts streaming for ULD  | `:Measurement[]` stream begins (only if ULD has IoT device)    | In-memory via M8 simulator          |
| Resources decrement                         | `coolRoomSlotsFree -= 1`, `buildupBaysFree -= 1` until release | `sessionStorage.resources-store`    |

Resetting a scenario or invoking `RESET` in `/dev/control` rolls back all sessionStorage mutations and clears IndexedDB tables.

---

## DG validation — DG AutoCheck Connect API

**API of record**: DG AutoCheck Connect API v1, spec in [`dg-autocheck-api/`](./dg-autocheck-api/). It's an async workflow (create AC → upload DGD → request URL → user verifies in vendor UI → webhook → CMS pulls XSDG export). The fixtures here are the **stub-mode** representation: pretending the AutoCheck workflow has already run and returned a passed XSDG, so the local demo has the post-AutoCheck shape without actually calling the vendor.

Two operating modes (M3 default vs M23 swap):

| Mode                  | Trigger                           | Shape                                                                  | Where used                                           |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| **Stub** (M3 default) | `DG_AUTOCHECK_ENABLED !== 'true'` | Synchronous validation against `dg-declarations.json` lookups          | Demo path; runs offline                              |
| **Real** (M23)        | `DG_AUTOCHECK_ENABLED === 'true'` | Async — opens AutoCheck UI in modal, awaits webhook, pulls XSDG export | "B-side" demo button if judges request live workflow |

In both modes, the canonical output for every piece is a `DgValidationResult { pieceIri, status: 'non-dg' | 'pending' | 'valid' | 'rejected', declaration?, reason? }`. Build-up canvas blocks sign-off until all DG-declared pieces are `valid`.

### Stub fixtures (`public/data/dg-declarations.json`)

Two pre-issued `:DgDeclaration` records, one per DG-declared piece in `shipments.json`. Shape is **form-complete**: every field on the IATA Shipper's Declaration for Dangerous Goods (DGD) is rendered from this fixture without further enrichment. When the real DG AutoCheck XSDG export shape arrives at M23 integration time, this file becomes the **derived cache** — what the adapter would have stored after a successful `acceptance-check-passed` webhook. Until then, it stands in as the source of truth.

#### Form field → fixture path

DGD UI inputs map onto the canonical `:DgDeclaration` like so. Adapter renderers MUST consume only these paths.

| Form section            | Form field           | Fixture path                                                                                              |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| Shipper and consignee   | Shipper              | `shipperParty.{name,address}`                                                                             |
|                         | Consignee            | `consigneeParty.{name,address}`                                                                           |
| Reference details       | AWB number           | derived from `issuedForWaybill` (parse `urn:cargo:waybill:<prefix>-<number>`)                             |
|                         | Shipper's reference  | `shippingRefNo`                                                                                           |
| Issuer                  | Issued by            | `issuerParty.{name,branch}`                                                                               |
| Transport details       | Airport of departure | `departureLocation` (resolve IRI → IATA via `airports.json`)                                              |
|                         | Airport of dest.     | `arrivalLocation` (same)                                                                                  |
|                         | Shipment limitation  | `shipmentLimitation` enum (`PASSENGER_AND_CARGO` \| `CARGO_AIRCRAFT_ONLY`)                                |
| Shipment details        | Shipment type        | `shipmentType` enum (`RADIOACTIVE` \| `NON_RADIOACTIVE`)                                                  |
| Goods description (row) | UN/ID                | `dgDeclaredItems[i].unId`                                                                                 |
|                         | Proper shipping name | `dgDeclaredItems[i].properShippingName`                                                                   |
|                         | Class                | `dgDeclaredItems[i].dgClass`                                                                              |
|                         | P. Group             | `dgDeclaredItems[i].packingGroup` (nullable — Class 9 lithium has none)                                   |
|                         | Quantity             | `numberOfPackages × packagingType + netQuantityPerPackage` (renderer composes "8 fibreboard box × 53 kg") |
|                         | P. Inst              | `dgDeclaredItems[i].packingInstruction` (+ `section` when Section I/II applies, e.g. PI 967 §II)          |
|                         | Authorization        | `dgDeclaredItems[i].authorization` (nullable — only special permits)                                      |
| Handling                | Handling information | `handlingInformation`                                                                                     |
| Signatory               | Name of signatory    | `signatoryParty.name` (+ `title` for footer)                                                              |
|                         | Date                 | `signedAt.date`                                                                                           |
|                         | (place)              | `signedAt.place`                                                                                          |

Compliance certification sentence (the legal "I hereby declare…" paragraph at the bottom of the DGD) lives at `complianceDeclarationText` — rendered verbatim, never edited.

#### Fixture content

`public/data/dg-declarations.json`:

```json
{
  "urn:cargo:dgdec:DG-LITHIUM-001": {
    "@id": "urn:cargo:dgdec:DG-LITHIUM-001",
    "@type": "DgDeclaration",
    "issuedForPiece": "urn:cargo:piece:176-45678901-1",
    "issuedForWaybill": "urn:cargo:waybill:176-45678901",
    "declarationDate": "2026-04-25T08:00:00+04:00",
    "declarationPlace": "urn:cargo:loc:DXB",
    "shippingRefNo": "TS-LION-9912",
    "departureLocation": "urn:cargo:loc:DXB",
    "arrivalLocation": "urn:cargo:loc:FRA",
    "shipmentLimitation": "CARGO_AIRCRAFT_ONLY",
    "aircraftLimitationInformation": "Cargo aircraft only",
    "shipmentType": "NON_RADIOACTIVE",
    "exclusiveUseIndicator": false,
    "shipperParty": {
      "@id": "urn:cargo:party:shipper:techship-dxb",
      "@type": "Party",
      "name": "TechShip Logistics FZE",
      "address": {
        "@type": "Address",
        "streetAddress": "DAFZA Block A, Office 412",
        "city": "Dubai",
        "country": "AE",
        "postalCode": "54123",
        "contact": "+971 4 555 0142"
      }
    },
    "consigneeParty": {
      "@id": "urn:cargo:party:consignee:mediatech-fra",
      "@type": "Party",
      "name": "MediaTech Distribution GmbH",
      "address": {
        "@type": "Address",
        "streetAddress": "Hanauer Landstrasse 287",
        "city": "Frankfurt am Main",
        "country": "DE",
        "postalCode": "60314",
        "contact": "+49 69 555 0188"
      }
    },
    "issuerParty": {
      "@id": "urn:cargo:party:issuer:techship-compliance",
      "@type": "Party",
      "name": "TechShip Logistics FZE — Compliance Desk",
      "branch": "DXB"
    },
    "dgDeclaredItems": [
      {
        "@id": "urn:cargo:dgitem:DG-LITHIUM-001-1",
        "@type": "DgDeclaredItem",
        "unId": "UN3481",
        "properShippingName": "Lithium ion batteries contained in equipment",
        "dgClass": "9",
        "packingGroup": null,
        "packagingType": "Fibreboard box (4G)",
        "numberOfPackages": 8,
        "netQuantityPerPackage": { "value": 53, "unit": "kg" },
        "packingInstruction": "967",
        "section": "II",
        "authorization": null
      }
    ],
    "handlingInformation": "Lithium ion batteries — handle with care; keep dry. Section II package; lithium battery mark applied per PI 967 §II. No Class 9 hazard label required.",
    "signatoryParty": {
      "@id": "urn:cargo:party:signatory:rashid-al-mansouri",
      "@type": "Party",
      "name": "Rashid Al Mansouri",
      "title": "Dangerous Goods Compliance Officer"
    },
    "signedAt": {
      "place": "Dubai, UAE",
      "date": "2026-04-25T08:00:00+04:00"
    },
    "complianceDeclarationText": "I hereby declare that the contents of this consignment are fully and accurately described above by the proper shipping name, and are classified, packaged, marked and labelled/placarded, and are in all respects in proper condition for transport according to applicable international and national governmental regulations. I declare that all of the applicable air transport requirements have been met."
  },
  "urn:cargo:dgdec:DG-CORROSIVE-001": {
    "@id": "urn:cargo:dgdec:DG-CORROSIVE-001",
    "@type": "DgDeclaration",
    "issuedForPiece": "urn:cargo:piece:176-89012345-1",
    "issuedForWaybill": "urn:cargo:waybill:176-89012345",
    "declarationDate": "2026-04-25T07:30:00+04:00",
    "declarationPlace": "urn:cargo:loc:DXB",
    "shippingRefNo": "CF-DXB-LHR-4471",
    "departureLocation": "urn:cargo:loc:DXB",
    "arrivalLocation": "urn:cargo:loc:LHR",
    "shipmentLimitation": "CARGO_AIRCRAFT_ONLY",
    "aircraftLimitationInformation": "Cargo aircraft only",
    "shipmentType": "NON_RADIOACTIVE",
    "exclusiveUseIndicator": true,
    "shipperParty": {
      "@id": "urn:cargo:party:shipper:chemfreight-dxb",
      "@type": "Party",
      "name": "ChemFreight Industries LLC",
      "address": {
        "@type": "Address",
        "streetAddress": "JAFZA South Zone, Warehouse 14",
        "city": "Jebel Ali, Dubai",
        "country": "AE",
        "postalCode": "17000",
        "contact": "+971 4 555 0901"
      }
    },
    "consigneeParty": {
      "@id": "urn:cargo:party:consignee:britchem-lhr",
      "@type": "Party",
      "name": "BritChem Holdings Ltd",
      "address": {
        "@type": "Address",
        "streetAddress": "Beddington Lane Industrial Estate, Unit 22",
        "city": "Croydon, London",
        "country": "GB",
        "postalCode": "CR0 4TD",
        "contact": "+44 20 7555 0233"
      }
    },
    "issuerParty": {
      "@id": "urn:cargo:party:issuer:chemfreight-compliance",
      "@type": "Party",
      "name": "ChemFreight Industries LLC — DG Desk",
      "branch": "DXB"
    },
    "dgDeclaredItems": [
      {
        "@id": "urn:cargo:dgitem:DG-CORROSIVE-001-1",
        "@type": "DgDeclaredItem",
        "unId": "UN1789",
        "properShippingName": "Hydrochloric acid solution",
        "dgClass": "8",
        "packingGroup": "II",
        "packagingType": "Plastic jerrican (3H1)",
        "numberOfPackages": 3,
        "netQuantityPerPackage": { "value": 30, "unit": "L" },
        "packingInstruction": "851",
        "section": null,
        "authorization": null
      }
    ],
    "handlingInformation": "Class 8 corrosive — keep upright. Stow away from foodstuffs and Class 1, 4.1, 5 cargo. Exclusive use; do not co-load.",
    "signatoryParty": {
      "@id": "urn:cargo:party:signatory:omar-khoury",
      "@type": "Party",
      "name": "Omar Khoury",
      "title": "DG Compliance Manager"
    },
    "signedAt": {
      "place": "Dubai, UAE",
      "date": "2026-04-25T07:30:00+04:00"
    },
    "complianceDeclarationText": "I hereby declare that the contents of this consignment are fully and accurately described above by the proper shipping name, and are classified, packaged, marked and labelled/placarded, and are in all respects in proper condition for transport according to applicable international and national governmental regulations. I declare that all of the applicable air transport requirements have been met."
  }
}
```

> Note on UN1789: per IATA DGR, **UN1789 = Hydrochloric acid solution** (Class 8, PG II or III). The earlier rev 1.0 description "Sulphuric acid solution, UN1789" mis-paired UN/proper shipping name; UN1789 in this fixture renders as the correct hydrochloric acid solution. AWB description in `shipments.json` ("Corrosive substance, ChemFreight") stays correct (generic).

#### Schema notes

- **Why a party graph not flat strings.** IATA ONE Record models each DGD party (`shipperParty`, `consigneeParty`, `issuerParty`, `signatoryParty`) as a `:Party` IRI with an `:Address`. This survives the M23 swap unchanged — XSDG `<Shipper>`/`<Consignee>` blocks de-serialise straight onto these nodes.
- **`declarationPlace` IRI vs `signedAt.place` text.** Both fields are kept. `declarationPlace` is the IRI-resolvable station (`urn:cargo:loc:DXB`) used by routing/auth logic. `signedAt.place` is the verbatim free-text string the shipper printed on the DGD ("Dubai, UAE") — rendered as-is, never auto-derived. Keeping both means the form preserves the shipper's wording while machine code keeps a stable IRI.
- **`shipmentLimitation` enum vs `aircraftLimitationInformation` text.** Same duality. Enum (`PASSENGER_AND_CARGO` \| `CARGO_AIRCRAFT_ONLY`) drives routing eligibility checks; free-text is rendered verbatim on the form. Required by the validator (`scripts/validate-fixtures.ts`) and by IATA ONE Record `:DgDeclaration`.
- **`dgDeclaredItems[]` is a list.** A DGD can carry multiple goods rows (different UN ids on one declaration). Both fixtures show single-item declarations; multi-item is left as a future fixture if a scenario needs it.
- **Section number coupled to packing instruction.** PI 967 has Sections I and II with different limits; renderer must show "967 §II" not just "967". Section field nullable for PIs without subsection (PI 851 has none).
- **`netQuantityPerPackage` units vary by goods.** Solids → kg; liquids → L; gases → L (water capacity). Renderer reads `unit` directly from the fixture, never re-derives.
- **Authorization is rare.** Only populated when the shipment travels under a state-of-origin or operator special permit. Both stub fixtures leave it null (standard PI shipments).

When M23 wires the real DG AutoCheck integration, the swap surface is:

- `lib/adapters/dg-check.ts` — gains a `mode: 'stub' | 'autocheck'` switch driven by env
- `lib/adapters/dg-autocheck/*.ts` — new directory: OAuth client, lifecycle endpoints, XSDG export parser, webhook signature verification
- `app/api/webhooks/dg-autocheck/route.ts` — new public webhook listener
- `dg-declarations.json` — becomes a derived cache populated by `acceptance-check-passed` webhook payload (XSDG export → canonical `:DgDeclaration`). XSDG fields map onto the schema above; **no schema extension needed** — only field-level mapping in the parser.

Everything downstream — build-up canvas, audit DB, supervisor surfaces, DGD form renderer — continues to consume the canonical `:DgDeclaration` shape, regardless of mode.

---

## Validation rules (M2 acceptance contract)

Tied to MILESTONES.md → **M2** success/test criteria. `scripts/validate-fixtures.ts` enforces:

- [ ] Every flight in `flights.json` is referenced by at least one scenario's `initial_state.flights` OR is the sandbox flight (EK0357)
- [ ] Every AWB in `shipments.json` lives under exactly one `flightNumber` key
- [ ] Every ULD in `uld-inventory.json` has either an `iotDeviceId` matching an entry in `iot-devices.json`, OR has no `iotDeviceId` (passive)
- [ ] Every IoT device referenced in `uld-inventory.json` exists in `iot-devices.json` and has 4 sensors (TEMPERATURE, HUMIDITY, GPS, SHOCK)
- [ ] Every `uldProductCode` in `uld-inventory.json` exists in `uld-specs.json`
- [ ] Every SHC code on AWBs is one of: `AVI`, `PER`, `COL`, `CRT`, `FRO`, `HEG` (matches `shc.json` keys)
- [ ] Every DG-declared piece carries a `dgDeclaration` IRI that resolves in `dg-declarations.json`
- [ ] Every geofence feature has a `referenceAmbientDeltaC` property (or explicit `null` for runway)
- [ ] Scenario `initial_state.flights` and `ulds` reference IDs that exist in fixtures
- [ ] Scenario `events[].uld_id` references a ULD ID that exists in fixtures
- [ ] At least one COL, PER, AVI, CRT, FRO, HEG AWB present across `shipments.json` (SHC coverage)
- [ ] At least one DG-declared AWB present (DG path coverage)
- [ ] At least one tracker-equipped ULD AND at least one passive ULD present (tracker-path coverage)

---

## Change protocol

Adding a new scenario, AWB, or ULD:

1. Update this doc's relevant section + the **Scenario Impact Matrix**
2. Update the JSON fixture(s)
3. Run `scripts/validate-fixtures.ts` — must exit 0
4. If a new SHC, ULD type, or DG class is introduced, also update PLAN.md → **SHC Config** (or the corresponding section)
5. If the change affects a milestone's success criteria, append a row to that milestone's **Revisions** table in MILESTONES.md
