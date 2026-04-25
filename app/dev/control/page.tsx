"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { isDemoMode } from "@/lib/env";
import { localPrefs } from "@/lib/persistence/local-prefs";
import {
  type Scenario,
  scenariosFileSchema,
  type ScenarioEvent,
} from "@/lib/simulator/scenario-schema";
import {
  demoScenarioRunner,
  type DemoFocusTarget,
  useScenarioRunnerStore,
} from "@/lib/simulator/scenario-runner";
import {
  type DemoPlayState,
  type DemoSpeedMultiplier,
  useDemoClockStore,
} from "@/lib/stores/demo-clock-store";
import { useResourcesStore } from "@/lib/stores/resources-store";
import { cn } from "@/lib/utils";

const SOUND_PREF_KEY = "dev-control-sound-enabled";
const WEATHER_PREF_KEY = "dev-control-force-mock-weather";
const SPEED_OPTIONS: DemoSpeedMultiplier[] = [1, 2, 5, 10];
const INJECT_EVENT_OPTIONS = [
  "ui_focus",
  "weather_override",
  "flight_delay",
  "notification",
  "alert",
  "physics_recompute",
  "uld_state_force",
  "wait_for_user_action",
  "uld_action_complete",
] as const;
const FOCUS_OPTIONS: DemoFocusTarget[] = [
  "flight_list",
  "flight_workspace",
  "build_up_canvas",
  "uld_detail",
  "supervisor_dashboard",
  "audit_log",
  "pitch_slide",
];
const ULD_STATE_OPTIONS = [
  "in-warehouse",
  "in-tarmac",
  "in-flight",
  "arrived-tarmac",
  "arrived-destination",
] as const;

type InjectEventType = (typeof INJECT_EVENT_OPTIONS)[number];
type UldState = (typeof ULD_STATE_OPTIONS)[number];

function formatTick(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function describePlayState(playState: DemoPlayState): string {
  return playState === "playing" ? "Playing" : "Paused";
}

function eventLabel(event: ScenarioEvent): string {
  const label = event["label"];
  if (typeof label === "string" && label.length > 0) {
    return label;
  }

  const target = event["target"];
  if (typeof target === "string" && target.length > 0) {
    return target;
  }

  const uldId = event["uldId"];
  if (typeof uldId === "string" && uldId.length > 0) {
    return uldId;
  }

  const flight = event["flight"];
  if (typeof flight === "string" && flight.length > 0) {
    return flight;
  }

  return "Scenario event";
}

function loadScenarioSummary(event: ScenarioEvent): string {
  const parts = Object.entries(event)
    .filter(([key]) => key !== "at_s" && key !== "type")
    .slice(0, 3)
    .map(([key, value]) => {
      if (typeof value === "string" || typeof value === "number") {
        return `${key}: ${value}`;
      }
      if (Array.isArray(value)) {
        return `${key}: ${value.join(", ")}`;
      }
      return null;
    })
    .filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(" | ") : eventLabel(event);
}

function injectEventHint(eventType: InjectEventType): string {
  switch (eventType) {
    case "ui_focus":
      return "Move the simulated UI to a specific screen target.";
    case "weather_override":
      return "Set the ambient temperature immediately.";
    case "flight_delay":
      return "Apply a schedule delay in minutes.";
    case "notification":
      return "Fire the browser notification handler with a title and body.";
    case "alert":
      return "Raise an in-app alert without a browser notification.";
    case "physics_recompute":
      return "Force a physics recompute for one ULD.";
    case "uld_state_force":
      return "Force a ULD lifecycle state for demo control.";
    case "wait_for_user_action":
      return "Pause playback until the expected action resolves or times out.";
    case "uld_action_complete":
      return "Complete a mitigation action and recover thermal budget.";
  }
}

function ManualInjectPanel() {
  const [eventType, setEventType] = useState<InjectEventType>("ui_focus");
  const [flightNo, setFlightNo] = useState("EK0083");
  const [uldId, setUldId] = useState("AKE-12345EK");
  const [focusTarget, setFocusTarget] = useState<DemoFocusTarget>("uld_detail");
  const [uldState, setUldState] = useState<UldState>("in-tarmac");
  const [title, setTitle] = useState("AKE-12345EK breach in 38 min");
  const [body, setBody] = useState("Tap for 3 actions");
  const [numericValue, setNumericValue] = useState("5");
  const [action, setAction] = useState("cool_dolly_retrieve");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runner = useScenarioRunnerStore(
    useShallow((state) => ({
      activeScenarioId: state.activeScenarioId,
      selectedFlightNo: state.selectedFlightNo,
      selectedUldId: state.selectedUldId,
      uiFocus: state.uiFocus,
    })),
  );

  const effectiveFlightNo = flightNo || runner.selectedFlightNo || "EK0083";
  const effectiveUldId = uldId || runner.selectedUldId || "AKE-12345EK";

  async function handleInject() {
    setStatusMessage("Injecting...");

    try {
      switch (eventType) {
        case "ui_focus":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            flightNo: effectiveFlightNo,
            target: focusTarget,
            type: "ui_focus",
            uldId: effectiveUldId,
          });
          break;
        case "weather_override":
          await demoScenarioRunner.injectEvent({
            ambient_c: Number(numericValue || "0"),
            at_s: 0,
            type: "weather_override",
          });
          break;
        case "flight_delay":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            delta_min: Number(numericValue || "0"),
            flight: effectiveFlightNo,
            type: "flight_delay",
          });
          break;
        case "notification":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            body,
            title,
            type: "notification",
            uldId: effectiveUldId,
          });
          break;
        case "alert":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            body,
            severity: "critical",
            title,
            type: "alert",
          });
          break;
        case "physics_recompute":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            type: "physics_recompute",
            uldId: effectiveUldId,
          });
          break;
        case "uld_state_force":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            state: uldState,
            type: "uld_state_force",
            uldId: effectiveUldId,
          });
          break;
        case "wait_for_user_action":
          await demoScenarioRunner.injectEvent({
            at_s: 0,
            expected: "execute_action_2",
            fallback_after_s: Number(numericValue || "15"),
            type: "wait_for_user_action",
            uldId: effectiveUldId,
          });
          break;
        case "uld_action_complete":
          await demoScenarioRunner.injectEvent({
            action,
            at_s: 0,
            budget_recovery_h: Number(numericValue || "5"),
            type: "uld_action_complete",
            uldId: effectiveUldId,
          });
          break;
      }

      setStatusMessage(`Injected ${eventType}`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : `Failed to inject ${eventType}`,
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Manual Inject</CardTitle>
            <CardDescription>{injectEventHint(eventType)}</CardDescription>
          </div>
          <Badge variant="outline">{runner.activeScenarioId}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">Event type</span>
          <select
            className="min-h-11 rounded-md border border-input bg-background px-3 text-base"
            onChange={(event) =>
              setEventType(event.target.value as InjectEventType)
            }
            value={eventType}
          >
            {INJECT_EVENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Flight</span>
            <Input
              className="min-h-11"
              onChange={(event) => setFlightNo(event.target.value)}
              value={effectiveFlightNo}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">ULD</span>
            <Input
              className="min-h-11"
              onChange={(event) => setUldId(event.target.value)}
              value={effectiveUldId}
            />
          </label>
        </div>

        {eventType === "ui_focus" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Focus target</span>
            <select
              className="min-h-11 rounded-md border border-input bg-background px-3 text-base"
              onChange={(event) =>
                setFocusTarget(event.target.value as DemoFocusTarget)
              }
              value={focusTarget}
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {eventType === "uld_state_force" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Forced state</span>
            <select
              className="min-h-11 rounded-md border border-input bg-background px-3 text-base"
              onChange={(event) => setUldState(event.target.value as UldState)}
              value={uldState}
            >
              {ULD_STATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {eventType === "notification" || eventType === "alert" ? (
          <div className="grid gap-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted-foreground">Title</span>
              <Input
                className="min-h-11"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted-foreground">Body</span>
              <Input
                className="min-h-11"
                onChange={(event) => setBody(event.target.value)}
                value={body}
              />
            </label>
          </div>
        ) : null}

        {eventType === "weather_override" ||
        eventType === "flight_delay" ||
        eventType === "wait_for_user_action" ||
        eventType === "uld_action_complete" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Numeric value</span>
            <Input
              className="min-h-11"
              onChange={(event) => setNumericValue(event.target.value)}
              value={numericValue}
            />
          </label>
        ) : null}

        {eventType === "uld_action_complete" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Action</span>
            <Input
              className="min-h-11"
              onChange={(event) => setAction(event.target.value)}
              value={action}
            />
          </label>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button className="min-h-11" onClick={() => void handleInject()}>
            Inject Event
          </Button>
          <div className="text-sm text-muted-foreground">
            {statusMessage ?? `Focused UI: ${runner.uiFocus}`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DevControlPage() {
  const [loadedScenarios, setLoadedScenarios] = useState<Scenario[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const runnerState = useScenarioRunnerStore(
    useShallow((state) => ({
      activeScenarioId: state.activeScenarioId,
      forceMockWeather: state.forceMockWeather,
      scenarios: state.scenarios,
      soundEnabled: state.soundEnabled,
      statusMessage: state.statusMessage,
      timeline: state.timeline,
      waitState: state.waitState,
      weather: state.weather,
    })),
  );
  const clockState = useDemoClockStore(
    useShallow((state) => ({
      currentTickSec: state.currentTickSec,
      playState: state.playState,
      speedMultiplier: state.speedMultiplier,
    })),
  );
  const resources = useResourcesStore(
    useShallow((state) => ({
      freeBuildupBays: state.freeBuildupBays,
      freeCoolDollies: state.freeCoolDollies,
      freeCoolRoomSlots: state.freeCoolRoomSlots,
    })),
  );

  useEffect(() => {
    let active = true;

    async function fetchScenarios() {
      try {
        const response = await fetch(`/data/scenarios.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        const parsed = scenariosFileSchema.safeParse(payload);

        if (!active) {
          return;
        }

        if (!response.ok || !parsed.success) {
          setLoadError("Failed to load scenarios.json");
          return;
        }

        setLoadedScenarios(parsed.data.scenarios);
        setLoadError(null);
      } catch {
        if (active) {
          setLoadError("Failed to load scenarios.json");
        }
      }
    }

    void fetchScenarios();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    demoScenarioRunner.setForceMockWeather(
      localPrefs.get<boolean>(WEATHER_PREF_KEY, runnerState.forceMockWeather),
    );
    demoScenarioRunner.setSoundEnabled(
      localPrefs.get<boolean>(SOUND_PREF_KEY, runnerState.soundEnabled),
    );
  }, [runnerState.forceMockWeather, runnerState.soundEnabled]);

  if (!isDemoMode) {
    return notFound();
  }

  const scenarios =
    loadedScenarios.length > 0 ? loadedScenarios : runnerState.scenarios;
  const activeScenario =
    scenarios.find(
      (scenario) => scenario.id === runnerState.activeScenarioId,
    ) ??
    scenarios[0] ??
    null;
  const nextPendingEvent =
    runnerState.timeline.find(
      (item) =>
        item.status === "pending" &&
        item.event.at_s >= clockState.currentTickSec,
    ) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Demo Control Panel</CardTitle>
                <CardDescription>
                  Scenario runner, deterministic playback, and manual inject.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  onClick={() => void demoScenarioRunner.play()}
                >
                  Play
                </Button>
                <Button
                  className="min-h-11"
                  onClick={() => void demoScenarioRunner.pause()}
                  variant="outline"
                >
                  Pause
                </Button>
                <Button
                  className="min-h-11"
                  onClick={() => void demoScenarioRunner.skip(15)}
                  variant="outline"
                >
                  Skip +15s
                </Button>
                <Button
                  className="min-h-11"
                  onClick={() => void demoScenarioRunner.reset()}
                  variant="secondary"
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <div className="rounded-lg border px-4 py-3">
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    Tick {clockState.currentTickSec}
                  </Badge>
                  <Badge variant="outline">
                    {describePlayState(clockState.playState)}
                  </Badge>
                  <Badge variant="outline">{clockState.speedMultiplier}x</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {runnerState.statusMessage ?? "Ready"}
                </div>
              </div>

              <div className="rounded-lg border px-4 py-3">
                <div className="text-sm text-muted-foreground">Clock</div>
                <div className="mt-1 text-xl font-semibold">
                  {formatTick(clockState.currentTickSec)}
                </div>
              </div>

              <div className="rounded-lg border px-4 py-3">
                <div className="text-sm text-muted-foreground">Ambient</div>
                <div className="mt-1 text-xl font-semibold">
                  {runnerState.weather.ambientC.toFixed(1)} C
                </div>
              </div>

              <div className="rounded-lg border px-4 py-3">
                <div className="text-sm text-muted-foreground">Speed</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="mt-1 min-h-11 w-full" variant="outline">
                      {clockState.speedMultiplier}x
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Speed</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {SPEED_OPTIONS.map((speed) => (
                        <DropdownMenuItem
                          key={speed}
                          onClick={() =>
                            demoScenarioRunner.setSpeedMultiplier(speed)
                          }
                        >
                          {speed}x
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scenario Picker</CardTitle>
                <CardDescription>
                  Loaded from `/public/data/scenarios.json`.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {activeScenario ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="min-h-11 justify-between"
                        variant="outline"
                      >
                        {activeScenario.name}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-w-sm">
                      <DropdownMenuLabel>Available Scenarios</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        {scenarios.map((scenario) => (
                          <DropdownMenuItem
                            key={scenario.id}
                            onClick={() =>
                              void demoScenarioRunner.selectScenario(
                                scenario.id,
                              )
                            }
                          >
                            {scenario.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {loadError ? (
                  <div className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-muted-foreground">
                    {loadError}. Using bundled runner scenarios.
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  {scenarios.map((scenario) => {
                    const isActive =
                      scenario.id === runnerState.activeScenarioId;

                    return (
                      <button
                        key={scenario.id}
                        className={cn(
                          "flex min-h-11 flex-col items-start gap-2 rounded-lg border px-4 py-3 text-left",
                          isActive
                            ? "border-primary bg-accent"
                            : "border-border",
                        )}
                        onClick={() =>
                          void demoScenarioRunner.selectScenario(scenario.id)
                        }
                        type="button"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className="text-base font-medium">
                            {scenario.name}
                          </span>
                          {isActive ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : null}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {scenario.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Toggles</CardTitle>
                <CardDescription>
                  Persisted locally for the demo surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-base font-medium">Weather mode</div>
                    <div className="text-sm text-muted-foreground">
                      {runnerState.forceMockWeather ? "Mock" : "Live"}
                    </div>
                  </div>
                  <Switch
                    checked={runnerState.forceMockWeather}
                    onCheckedChange={(checked) => {
                      demoScenarioRunner.setForceMockWeather(checked);
                      localPrefs.set(WEATHER_PREF_KEY, checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-base font-medium">Sound</div>
                    <div className="text-sm text-muted-foreground">
                      {runnerState.soundEnabled ? "On" : "Off"}
                    </div>
                  </div>
                  <Switch
                    checked={runnerState.soundEnabled}
                    onCheckedChange={(checked) => {
                      demoScenarioRunner.setSoundEnabled(checked);
                      localPrefs.set(SOUND_PREF_KEY, checked);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resources</CardTitle>
                <CardDescription>
                  Live values from `resources-store`.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    Cool dollies
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {resources.freeCoolDollies}
                  </div>
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    Cool room slots
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {resources.freeCoolRoomSlots}
                  </div>
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    Build-up bays
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {resources.freeBuildupBays}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <main className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Timeline</CardTitle>
                <CardDescription>
                  Current scenario queue with the next pending event
                  highlighted.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {runnerState.timeline.length > 0 ? (
                  runnerState.timeline.map((item) => {
                    const isUpcoming = item.id === nextPendingEvent?.id;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-lg border px-4 py-3",
                          item.status === "dispatched" &&
                            "border-primary/40 bg-accent/60",
                          item.status === "pending" && "border-border",
                          isUpcoming && "border-amber-500 bg-amber-500/10",
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm text-muted-foreground">
                              t={item.event.at_s}s
                            </div>
                            <div className="text-base font-medium">
                              {item.event.type}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {loadScenarioSummary(item.event)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {isUpcoming ? (
                              <Badge variant="secondary">Upcoming</Badge>
                            ) : null}
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                    No scripted events in this scenario.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Scenario Status</CardTitle>
                  <CardDescription>
                    Current scenario metadata and wait-state visibility.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                      Scenario
                    </div>
                    <div className="mt-1 text-base font-medium">
                      {activeScenario?.name ?? "Unavailable"}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                      Duration
                    </div>
                    <div className="mt-1 text-base font-medium">
                      {activeScenario?.duration_seconds === null
                        ? "Open-ended"
                        : `${activeScenario?.duration_seconds ?? 0}s`}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                      Next event
                    </div>
                    <div className="mt-1 text-base font-medium">
                      {nextPendingEvent
                        ? eventLabel(nextPendingEvent.event)
                        : "None pending"}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                      Wait state
                    </div>
                    <div className="mt-1 text-base font-medium">
                      {runnerState.waitState
                        ? `${runnerState.waitState.expected} (${runnerState.waitState.fallbackAfterSec}s)`
                        : "Idle"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ManualInjectPanel />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
