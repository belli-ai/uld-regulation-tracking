"use client";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DgValidationResult } from "@/lib/build-up/dg-checker";
import { cn } from "@/lib/utils";

import type { BuildUpDropRejection, BuildUpWaybill } from "./build-up-canvas";

type Props = {
  checking: boolean;
  rejection: BuildUpDropRejection | null;
  results: DgValidationResult[];
  waybills: BuildUpWaybill[];
};

function getTone(
  results: DgValidationResult[],
  rejection: BuildUpDropRejection | null,
  pieceCount: number,
  checking: boolean,
): "green" | "yellow" | "red" {
  if (rejection || results.some((result) => result.status === "rejected")) {
    return "red";
  }

  if (checking || pieceCount === 0) {
    return "yellow";
  }

  return "green";
}

function ToneIcon({ tone }: { tone: "green" | "yellow" | "red" }) {
  if (tone === "green") {
    return <CheckCircle2 className="text-emerald-400" />;
  }
  if (tone === "red") {
    return <XCircle className="text-red-400" />;
  }
  return <AlertTriangle className="text-amber-400" />;
}

function getWaybillLabel(waybill: BuildUpWaybill): string {
  return `${waybill.waybillPrefix}-${waybill.waybillNumber}`;
}

function getWaybillStatus(
  waybill: BuildUpWaybill,
  resultsById: Map<string, DgValidationResult>,
): {
  reason: string;
  status: "non-dg" | "valid" | "rejected";
} {
  let hasValid = false;

  for (const piece of waybill.pieces) {
    const result = resultsById.get(piece["@id"]);

    if (result?.status === "rejected") {
      return {
        reason: result.reason,
        status: "rejected",
      };
    }

    if (result?.status === "valid") {
      hasValid = true;
    }
  }

  if (hasValid) {
    return {
      reason: "DG declaration accepted for this flight.",
      status: "valid",
    };
  }

  return {
    reason: "No DG declaration required.",
    status: "non-dg",
  };
}

export function DgCheckRow({ checking, rejection, results, waybills }: Props) {
  const pieces = waybills.flatMap((waybill) => waybill.pieces);
  const tone = getTone(results, rejection, pieces.length, checking);
  const resultsById = new Map(
    results.map((result) => [result.piece["@id"], result] as const),
  );

  return (
    <Card
      className={cn(
        "border-border/80",
        tone === "red" && "border-red-500/60",
        tone === "yellow" && "border-amber-500/60",
        tone === "green" && "border-emerald-500/60",
      )}
    >
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {checking ? (
              <Loader2 className="animate-spin text-amber-400" />
            ) : (
              <ToneIcon tone={tone} />
            )}
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">DG check</CardTitle>
              <CardDescription className="text-sm md:text-base">
                {checking
                  ? "Checking loaded shipments against the DG validator."
                  : tone === "red"
                    ? "A DG-declared shipment failed validation."
                    : waybills.length === 0
                      ? "Drop an AWB to run DG validation."
                      : "All loaded shipments are valid or non-DG."}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={
              tone === "red"
                ? "destructive"
                : tone === "green"
                  ? "default"
                  : "secondary"
            }
            className="min-h-7"
          >
            {tone === "green" ? "Pass" : tone === "red" ? "Blocked" : "Pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rejection ? (
          <div className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">
            <div className="font-medium">{rejection.awbLabel} rolled back</div>
            <div className="mt-1 flex flex-col gap-1 text-red-200">
              {rejection.reasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
          </div>
        ) : null}

        {waybills.length > 0 ? (
          <div className="flex flex-col gap-2">
            {waybills.map((waybill) => {
              const result = getWaybillStatus(waybill, resultsById);
              const rejected = result.status === "rejected";
              const toneClass = rejected
                ? "border-red-500/40 bg-red-500/10 text-red-100"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";

              return (
                <div
                  key={waybill["@id"]}
                  className={cn(
                    "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border px-3 py-2 text-sm",
                    toneClass,
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {getWaybillLabel(waybill)} · {waybill.shc || "GEN"}
                    </div>
                    <div className="truncate text-xs opacity-80">
                      {waybill.pieces.length} pcs · {result.reason}
                    </div>
                  </div>
                  <Badge
                    variant={rejected ? "destructive" : "secondary"}
                    className="min-h-7 shrink-0"
                  >
                    {result.status === "valid"
                      ? "Valid"
                      : result.status === "rejected"
                        ? "Rejected"
                        : "Non-DG"}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            DG results will appear here after the first drop.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
