import { z } from "zod";

const weatherOverrideSchema = z
  .object({
    ambient_c: z.number(),
    humidity_pct: z.number().optional(),
    cloud_cover_pct: z.number().optional(),
  })
  .strict();

const resourcesSchema = z
  .object({
    cool_dollies_free: z.number().optional(),
    cool_room_slots_free: z.number().optional(),
    buildup_bays_free: z.number().optional(),
    breakdown_bays_free: z.number().optional(),
  })
  .partial();

const initialStateSchema = z
  .object({
    station: z.string().optional(),
    time_of_day: z
      .enum(["morning", "afternoon", "evening", "night"])
      .optional(),
    weather_override: weatherOverrideSchema.optional(),
    flights: z.array(z.string()).optional(),
    uld_inventory: z.string().optional(),
    ulds: z.array(z.string()).optional(),
    resources: resourcesSchema.optional(),
  })
  .strict();

const eventSchema = z
  .object({
    at_s: z.number().nonnegative(),
    type: z.string().min(1),
  })
  .catchall(z.unknown());

export const scenarioSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    duration_seconds: z.number().nullable(),
    tags: z.array(z.string()),
    initial_state: initialStateSchema.optional(),
    events: z.array(eventSchema).optional(),
  })
  .strict();

export const scenariosFileSchema = z
  .object({
    scenarios: z.array(scenarioSchema).min(1),
  })
  .strict();

export type ScenarioEvent = z.infer<typeof eventSchema>;
export type ScenarioInitialState = z.infer<typeof initialStateSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenariosFile = z.infer<typeof scenariosFileSchema>;
