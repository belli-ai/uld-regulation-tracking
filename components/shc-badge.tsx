"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  shc: string;
};

const SHC_STYLES: Record<string, string> = {
  COL: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PER: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  AVI: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  CRT: "border-border bg-muted text-muted-foreground",
  FRO: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  HEG: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
};

export function ShcBadge({ shc }: Props) {
  const label = shc.trim().toUpperCase() || "UNK";

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full font-mono text-xs font-semibold tracking-[0.14em]",
        SHC_STYLES[label] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </Badge>
  );
}
