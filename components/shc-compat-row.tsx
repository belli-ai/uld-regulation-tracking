"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConflictReason } from "@/lib/build-up/shc-compat";
import { cn } from "@/lib/utils";

type Props = {
  conflicts: ConflictReason[];
  hasPieces: boolean;
  ok: boolean;
};

function ToneIcon({ tone }: { tone: "green" | "yellow" | "red" }) {
  if (tone === "green") {
    return <CheckCircle2 className="text-emerald-400" />;
  }
  if (tone === "red") {
    return <XCircle className="text-red-400" />;
  }
  return <AlertTriangle className="text-amber-400" />;
}

export function ShcCompatRow({ conflicts, hasPieces, ok }: Props) {
  const tone = !hasPieces ? "yellow" : ok ? "green" : "red";

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
            <ToneIcon tone={tone} />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">SHC compatibility</CardTitle>
              <CardDescription className="text-sm md:text-base">
                {!hasPieces
                  ? "Drop AWBs to compare temperature envelopes."
                  : ok
                    ? "All loaded pieces share a compatible temperature range."
                    : "Conflicting SHC temperature requirements detected."}
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
            {tone === "green" ? "OK" : tone === "red" ? "Conflict" : "Waiting"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {hasPieces && ok ? (
          <div className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
            Compatible mix confirmed for the current ULD contents.
          </div>
        ) : null}

        {!ok
          ? conflicts.map((conflict) => (
              <div
                key={`${conflict.pieceIds[0]}:${conflict.pieceIds[1]}`}
                className="border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-100"
              >
                <div className="font-medium">
                  {conflict.shcCodes[0]} vs {conflict.shcCodes[1]}
                </div>
                <div className="mt-1 text-red-200">{conflict.reason}</div>
              </div>
            ))
          : null}
      </CardContent>
    </Card>
  );
}
