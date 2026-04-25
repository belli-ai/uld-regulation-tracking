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
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">AWB manifest</CardTitle>
            <CardDescription>
              AWB no, SHC, weight, and piece count for this departure.
            </CardDescription>
          </div>
          <Badge variant="outline">{shipments.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
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
            const isClickable = Boolean(assignedUld);

            return (
              <Button
                key={waybill["@id"]}
                className={cn(
                  "h-auto min-h-16 w-full justify-start border border-border/60 bg-background/35 px-4 py-3 text-left",
                  "hover:border-primary/50 hover:bg-primary/5",
                  !isClickable &&
                    "cursor-default hover:border-transparent hover:bg-muted/30",
                )}
                disabled={!isClickable}
                onClick={() => {
                  if (assignedUld) {
                    onOpenAssignedUld(assignedUld);
                  }
                }}
                variant="ghost"
              >
                <div className="flex w-full items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold">
                        {formatAwbNumber(waybill)}
                      </span>
                      <Badge variant={badgeVariantForShc(waybill.shc)}>
                        {waybill.shc || "TBD"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{totalWeightKg(waybill).toFixed(0)} kg</span>
                      <span>{waybill.pieces.length} pcs</span>
                      <span>
                        {assignedUld ? `Built in ${assignedUld}` : "Unassigned"}
                      </span>
                    </div>
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
