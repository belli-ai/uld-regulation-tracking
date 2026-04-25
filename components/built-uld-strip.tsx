"use client";

import { ShcBadge } from "@/components/shc-badge";
import { ThermalBudgetBar } from "@/components/thermal-budget-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ULD } from "@/lib/ontology/one-record";
import { cn } from "@/lib/utils";

type UldState = "warehouse" | "tarmac" | "in-flight" | "arrived-tarmac" | "arrived-destination";

export type BuiltUldStripEntry = {
  uld: ULD;
  shc: string;
  awbCount: number;
  currentState: UldState;
  thermalBudgetLabel: string;
};

type Props = {
  entries: BuiltUldStripEntry[];
  onOpenUld: (uldSerialNumber: string) => void;
};

const STATE_LABELS: Record<UldState, string> = {
  warehouse: "Warehouse",
  tarmac: "Tarmac",
  "in-flight": "In flight",
  "arrived-tarmac": "Arrived tarmac",
  "arrived-destination": "Arrived destination",
};

export function BuiltUldStrip({ entries, onOpenUld }: Props) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Built ULDs for this flight</CardTitle>
            <CardDescription>
              Tracking strip with SHC, AWB count, state, and thermal placeholder.
            </CardDescription>
          </div>
          <Badge variant="outline">{entries.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No built ULDs for this flight yet.
            </div>
          ) : null}

          {entries.map((entry) => (
            <Button
              key={entry.uld["@id"]}
              className={cn(
                "h-auto min-h-16 w-full justify-start rounded-lg border border-transparent px-4 py-3 text-left",
                "hover:border-border hover:bg-muted/60",
              )}
              onClick={() => onOpenUld(entry.uld.uldSerialNumber)}
              variant="ghost"
            >
              <div className="flex w-full flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <span className="text-base font-semibold">
                    {entry.uld.uldSerialNumber}
                  </span>
                  <ShcBadge shc={entry.shc} />
                  <Badge variant="outline">{entry.awbCount} AWBs</Badge>
                  <Badge variant="secondary">
                    {STATE_LABELS[entry.currentState]}
                  </Badge>
                </div>
                <div className="min-w-64">
                  <ThermalBudgetBar
                    breachAt={null}
                    budgetH={6}
                    warning="yellow"
                  />
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
