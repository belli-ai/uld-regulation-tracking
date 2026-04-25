"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { missionCardClassName } from "@/components/mission-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Waybill } from "@/lib/ontology/one-record";

type Props = {
  shipments: Waybill[];
  assignedUldByWaybill: Record<string, string>;
  isLoading?: boolean;
  onOpenAssignedUld: (uldSerialNumber: string) => void;
};

function formatAwbNumber(waybill: Waybill) {
  return `${waybill.waybillPrefix}-${waybill.waybillNumber}`;
}

function totalWeightKg(waybill: Waybill) {
  return waybill.pieces.reduce((sum, piece) => {
    const weight =
      piece.grossWeight.unit === "lb"
        ? piece.grossWeight.value * 0.453592
        : piece.grossWeight.value;

    return sum + weight;
  }, 0);
}

function badgeVariantForShc(shc: string) {
  if (shc === "AVI") {
    return "destructive" as const;
  }

  if (shc === "COL" || shc === "PER" || shc === "FRO") {
    return "default" as const;
  }

  return "secondary" as const;
}

export function AwbManifestPanel({
  shipments,
  assignedUldByWaybill,
  isLoading = false,
  onOpenAssignedUld,
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
            <CardTitle className="text-base">AWB manifest</CardTitle>
            <CardDescription className="text-xs">
              AWB, SHC, load, and assignment.
            </CardDescription>
          </div>
          <Badge variant="outline">{shipments.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-col gap-2">
          {isLoading && shipments.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Loading manifest...
            </div>
          ) : null}

          {!isLoading && shipments.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No AWBs available for this flight.
            </div>
          ) : null}

          {shipments.map((waybill) => {
            const assignedUld = assignedUldByWaybill[waybill["@id"]];
            const isBuilt = Boolean(assignedUld);

            return (
              <Button
                key={waybill["@id"]}
                className={cn(
                  "h-auto min-h-12 w-full justify-start border border-border/60 bg-background/35 px-3 py-2 text-left",
                  "hover:border-primary/50 hover:bg-primary/5",
                  isBuilt && "border-primary/40 bg-primary/5",
                  !isBuilt &&
                    "cursor-default hover:border-transparent hover:bg-muted/30",
                )}
                disabled={!isBuilt}
                onClick={() => {
                  if (assignedUld) {
                    onOpenAssignedUld(assignedUld);
                  }
                }}
                variant="ghost"
              >
                <div className="grid w-full grid-cols-[minmax(0,1fr)_86px_112px] items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {formatAwbNumber(waybill)}
                      </span>
                      <Badge variant={badgeVariantForShc(waybill.shc)}>
                        {waybill.shc || "TBD"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {totalWeightKg(waybill).toFixed(0)} kg
                    <span className="pl-1">{waybill.pieces.length} pcs</span>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-1">
                    <Badge variant={isBuilt ? "default" : "outline"}>
                      {isBuilt ? "Built" : "Open"}
                    </Badge>
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      {assignedUld ?? "No ULD"}
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
