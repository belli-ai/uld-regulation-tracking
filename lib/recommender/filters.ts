import type { Action } from "@/lib/recommender/action-library";

export type UldContext = {
  uldId: string;
  shc: string[];
  state: string;
  timeToBreach: number;
};

export type StationCapabilities = {
  iata: string;
  name: string;
  ceivCertified: boolean;
  resources: {
    coolDolliesTotal: number;
    coolRoomSlotsTotal?: number;
    buildupBaysTotal: number;
    breakdownBaysTotal?: number;
  };
  policies: {
    gpu?: string;
    shadingZones: string[];
    thermalBlanketStock: string;
    wetRagAuthorised: string;
  };
  operatingHours: string;
};

export type Resources = {
  freeCoolDollies: number;
  freeBuildupBays: number;
  freeShadingZones: number;
  thermalBlanketStock: number;
};

function intersects(left: string[], right: string[]): boolean {
  return left.some((value) => right.includes(value));
}

function hasStationCapability(
  station: StationCapabilities,
  capability: string,
): boolean {
  switch (capability) {
    case "coolDolliesTotal":
      return station.resources.coolDolliesTotal > 0;
    case "coolRoomSlotsTotal":
      return (station.resources.coolRoomSlotsTotal ?? 0) > 0;
    case "buildupBaysTotal":
      return station.resources.buildupBaysTotal > 0;
    case "breakdownBaysTotal":
      return (station.resources.breakdownBaysTotal ?? 0) > 0;
    case "shadingZones":
      return station.policies.shadingZones.length > 0;
    case "thermalBlanketStock":
      return station.policies.thermalBlanketStock === "Y";
    case "wetRagAuthorised":
      return station.policies.wetRagAuthorised === "Y";
    case "ceivCertified":
      return station.ceivCertified;
    default:
      return false;
  }
}

function hasRequiredResources(action: Action, resources: Resources): boolean {
  return action.requiresStationCapability.every((capability) => {
    switch (capability) {
      case "coolDolliesTotal":
        return resources.freeCoolDollies > 0;
      case "buildupBaysTotal":
        return resources.freeBuildupBays > 0;
      case "shadingZones":
        return resources.freeShadingZones > 0;
      case "thermalBlanketStock":
        return resources.thermalBlanketStock > 0;
      default:
        return true;
    }
  });
}

export function filterActions(
  actions: Action[],
  ctx: UldContext,
  station: StationCapabilities,
  resources: Resources,
): Action[] {
  return actions.filter((action) => {
    const matchesState = action.applicableStates.includes(ctx.state);
    const matchesShc =
      action.applicableShc.length === 0 || intersects(action.applicableShc, ctx.shc);
    const stationReady = action.requiresStationCapability.every((capability) =>
      hasStationCapability(station, capability),
    );
    const canExecuteBeforeBreach = action.executionMinutes <= ctx.timeToBreach;
    const resourcesReady = hasRequiredResources(action, resources);

    return (
      matchesState &&
      matchesShc &&
      stationReady &&
      canExecuteBeforeBreach &&
      resourcesReady
    );
  });
}
