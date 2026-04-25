"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type InventoryUld } from "@/lib/stores/inventory-store";

type Props = {
  flightNo: string;
  inventory: InventoryUld[];
  isLoading?: boolean;
  onBuildNewUld: () => void;
  onOpenBuildUp: (uld: InventoryUld) => void;
};

function serviceabilityVariant(code: InventoryUld["serviceabilityCode"]) {
  if (code === "DAM") {
    return "destructive" as const;
  }

  if (code === "CON") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function isRowActionable(uld: InventoryUld) {
  return uld.serviceabilityCode === "SER" && !uld.damageFlag;
}

export function UldInventoryPanel({
  flightNo,
  inventory,
  isLoading = false,
  onBuildNewUld,
  onOpenBuildUp,
}: Props) {
  const availableCount = inventory.filter(
    (uld) => isRowActionable(uld) && uld.buildUpStatus !== "in-build-up",
  ).length;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">ULD inventory</CardTitle>
            <CardDescription>
              Available equipment for build-up on {flightNo}.
            </CardDescription>
          </div>
          <Badge variant="outline">{availableCount} ready</Badge>
        </div>
        <Button
          className="w-full justify-center"
          disabled={availableCount === 0}
          onClick={onBuildNewUld}
        >
          + Build new ULD
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {isLoading && inventory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Loading inventory...
            </div>
          ) : null}

          {!isLoading && inventory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No ULD inventory available at DXB.
            </div>
          ) : null}

          {inventory.map((uld) => {
            const actionable = isRowActionable(uld);

            return (
              <Button
                key={uld["@id"]}
                className={cn(
                  "h-auto min-h-16 w-full justify-start rounded-lg border border-transparent px-4 py-3 text-left",
                  "hover:border-border hover:bg-muted/60",
                  !actionable &&
                    "cursor-default hover:border-transparent hover:bg-muted/30",
                )}
                disabled={!actionable}
                onClick={() => onOpenBuildUp(uld)}
                variant="ghost"
              >
                <div className="flex w-full items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold">
                        {uld.uldSerialNumber}
                      </span>
                      <Badge variant="secondary">{uld.uldTypeCode}</Badge>
                      <Badge variant="outline">{uld.ownerCode}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>Type {uld.uldTypeCode}</span>
                      <span>Owner {uld.ownerCode}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={serviceabilityVariant(uld.serviceabilityCode)}>
                      {uld.serviceabilityCode}
                    </Badge>
                    {uld.buildUpStatus === "in-build-up" ? (
                      <Badge variant="default">In build-up</Badge>
                    ) : (
                      <Badge variant="secondary">Available</Badge>
                    )}
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
