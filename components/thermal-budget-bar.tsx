"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Props = {
  budgetH: number;
  breachAt: string | Date | null;
  warning: "green" | "yellow" | "red";
};

function formatBreachAt(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function ThermalBudgetBar({ budgetH, breachAt, warning }: Props) {
  const clampedBudget = Math.max(budgetH, 0);
  const normalizedValue = Math.max(
    0,
    Math.min((clampedBudget / 12) * 100, 100),
  );

  return (
    <div className="flex flex-col gap-2 border border-border/70 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Budget
        </span>
        <span className="font-mono text-lg font-bold text-foreground">
          {clampedBudget.toFixed(1)} h
        </span>
      </div>
      <Progress
        value={normalizedValue}
        className={cn("[&>div]:transition-all", {
          "[&>div]:bg-emerald-500": warning === "green",
          "[&>div]:bg-yellow-500": warning === "yellow",
          "[&>div]:bg-destructive": warning === "red",
        })}
        aria-label="Thermal budget remaining"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{warning.toUpperCase()}</span>
        <span>
          {(() => {
            const formatted = formatBreachAt(breachAt);
            return formatted === null
              ? "No breach predicted"
              : `Breach at ${formatted}`;
          })()}
        </span>
      </div>
    </div>
  );
}
