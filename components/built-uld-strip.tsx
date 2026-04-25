"use client";

import Link from "next/link";
import { RadioTower } from "lucide-react";
import { ShcBadge } from "@/components/shc-badge";
import { ThermalBudgetBar } from "@/components/thermal-budget-bar";
import { missionCardClassName } from "@/components/mission-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ULD } from "@/lib/ontology/one-record";
import { cn } from "@/lib/utils";

type UldState =
  | "warehouse"
  | "tarmac"
  | "in-flight"
  | "arrived-tarmac"
  | "arrived-destination";

export type BuiltUldStripEntry = {
  uld: ULD;
  shc: string;
  awbCount: number;
  budgetH: number;
  budgetTone: "green" | "yellow" | "red";
  currentState: UldState;
  thermalBudgetLabel: string;
};

type Props = {
  entries: BuiltUldStripEntry[];
  monitorHref?: string;
  openAwbCount?: number;
  onOpenUld: (uldSerialNumber: string) => void;
};

const STATE_LABELS: Record<UldState, string> = {
  warehouse: "Warehouse",
  tarmac: "Tarmac",
  "in-flight": "In flight",
  "arrived-tarmac": "Arrived tarmac",
  "arrived-destination": "Arrived destination",
};

export function BuiltUldStrip({
  entries,
  monitorHref,
  onOpenUld,
  openAwbCount,
}: Props) {
  return (
    <Card
      className={cn(
        missionCardClassName,
        "flex h-full min-h-0 flex-col overflow-hidden",
      )}
    >
      <CardHeader className="gap-2 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Built ULDs</CardTitle>
            <CardDescription className="text-xs">
              SHC, AWB count, state, and thermal placeholder.
            </CardDescription>
          </div>
          <Badge variant="outline">{entries.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-col gap-2">
          {entries.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No built ULDs for this flight yet.
            </div>
          ) : null}

          {entries.map((entry) => (
            <Button
              key={entry.uld["@id"]}
              className={cn(
                "h-auto min-h-12 w-full justify-start border border-border/60 bg-background/35 px-3 py-2 text-left",
                "hover:border-primary/50 hover:bg-primary/5",
              )}
              onClick={() => onOpenUld(entry.uld.uldSerialNumber)}
              variant="ghost"
            >
              <div className="grid w-full items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.46fr)]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {entry.uld.uldSerialNumber}
                  </span>
                  <ShcBadge shc={entry.shc} />
                  <Badge variant="outline">{entry.awbCount} AWBs</Badge>
                  <Badge variant="secondary">
                    {STATE_LABELS[entry.currentState]}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <ThermalBudgetBar
                    breachAt={null}
                    budgetH={entry.budgetH}
                    warning={entry.budgetTone}
                  />
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/70 p-4">
        {entries.length > 0 && monitorHref ? (
          <div className="flex w-full flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={monitorHref}>
                <RadioTower data-icon="inline-start" />
                Monitor flight
              </Link>
            </Button>
            {typeof openAwbCount === "number" ? (
              <p className="text-xs text-muted-foreground">
                {openAwbCount === 0
                  ? "All AWBs built. Dispatch and loading controls are ready."
                  : `${openAwbCount} AWBs still open. Monitor signed-off ULDs now.`}
              </p>
            ) : null}
          </div>
        ) : (
          <Button className="w-full" disabled>
            <RadioTower data-icon="inline-start" />
            Monitor flight
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
