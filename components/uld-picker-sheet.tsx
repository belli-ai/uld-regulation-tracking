"use client";

import { PackagePlus } from "lucide-react";

import type { AutoBuildUldSpec } from "@/lib/build-up/auto-build";
import { type InventoryUld } from "@/lib/stores/inventory-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  flightNo: string;
  inventory: InventoryUld[];
  isLoading?: boolean;
  onOpenBuildUp: (uld: InventoryUld) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  specs: Record<string, AutoBuildUldSpec>;
};

function isReady(uld: InventoryUld): boolean {
  return (
    uld.serviceabilityCode === "SER" &&
    !uld.damageFlag &&
    uld.buildUpStatus !== "in-build-up"
  );
}

function getSpec(
  uld: InventoryUld,
  specs: Record<string, AutoBuildUldSpec>,
): AutoBuildUldSpec | null {
  return uld.uldProductCode ? (specs[uld.uldProductCode] ?? null) : null;
}

export function UldPickerSheet({
  flightNo,
  inventory,
  isLoading = false,
  onOpenBuildUp,
  onOpenChange,
  open,
  specs,
}: Props) {
  const readyInventory = inventory.filter(isReady);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>ULD picker</SheetTitle>
          <SheetDescription>
            Ready equipment for manual build-up on {flightNo}.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 border-b border-border bg-muted/20 px-5 py-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Ready
            </div>
            <div className="text-lg font-semibold">{readyInventory.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Fleet
            </div>
            <div className="text-lg font-semibold">{inventory.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Flight
            </div>
            <div className="text-lg font-semibold">{flightNo}</div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-5">
            {isLoading && inventory.length === 0 ? (
              <div className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Loading ready equipment...
              </div>
            ) : null}

            {!isLoading && readyInventory.length === 0 ? (
              <div className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                No serviceable ULDs are available for build-up.
              </div>
            ) : null}

            {readyInventory.map((uld) => {
              const spec = getSpec(uld, specs);

              return (
                <Button
                  key={uld["@id"]}
                  variant="ghost"
                  className={cn(
                    "h-auto min-h-20 w-full justify-start border border-border/70 bg-background/50 px-4 py-3 text-left",
                    "hover:border-primary/50 hover:bg-primary/5",
                  )}
                  onClick={() => {
                    onOpenBuildUp(uld);
                    onOpenChange(false);
                  }}
                >
                  <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold">
                          {uld.uldSerialNumber}
                        </span>
                        <Badge variant="secondary">{uld.uldTypeCode}</Badge>
                        <Badge variant="outline">{uld.ownerCode}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {spec?.label ?? uld.uldProductCode ?? "Generic ULD"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(spec?.supportedShc ?? ["TBD"]).map((shc) => (
                          <Badge key={shc} variant="outline">
                            {shc}
                          </Badge>
                        ))}
                        {typeof uld.lastKnownInternalC === "number" ? (
                          <Badge variant="secondary">
                            {uld.lastKnownInternalC.toFixed(1)}°C
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <PackagePlus />
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
