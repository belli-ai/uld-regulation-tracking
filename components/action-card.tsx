"use client";

import { CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { missionCardClassName } from "@/components/mission-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RankedAction } from "@/lib/recommender/ranker";
import { cn } from "@/lib/utils";

type Props = {
  action: RankedAction;
  onExecute: (action: RankedAction) => void;
  onRequest: (action: RankedAction) => void;
  onEscalate: (action: RankedAction) => void;
  executing?: boolean;
  executed?: boolean;
  executedLabel?: string | null;
};

function formatBenefit(action: RankedAction): string {
  return `+${action.benefitHours[0]}-${action.benefitHours[1]} h`;
}

function formatCost(action: RankedAction): string {
  return `${action.costTier} cost`;
}

export function ActionCard({
  action,
  onExecute,
  onRequest,
  onEscalate,
  executing = false,
  executed = false,
  executedLabel = null,
}: Props) {
  const disabled = executing || executed;

  return (
    <Card
      className={cn(missionCardClassName, executed && "border-emerald-500/40")}
    >
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold leading-none">
            {action.label}
          </CardTitle>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            #{action.rank}
          </span>
        </div>
        <CardDescription>
          {action.category} • {action.authority}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Benefit
            </p>
            <p className="pt-1 text-base text-foreground">
              {formatBenefit(action)}
            </p>
          </div>
          <div className="border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Cost
            </p>
            <p className="pt-1 text-base capitalize text-foreground">
              {formatCost(action)}
            </p>
          </div>
          <div className="border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Execution
            </p>
            <p className="pt-1 text-base text-foreground">
              {action.executionMinutes} min
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {executed ? (
          <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            >
              <CheckCircle2 className="size-3.5" /> Executed
            </Badge>
            {executedLabel ? (
              <span className="font-mono text-xs text-muted-foreground">
                Logged at {executedLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <>
            <Button
              className="w-full sm:flex-1"
              disabled={disabled}
              onClick={() => onExecute(action)}
            >
              {executing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Executing…
                </>
              ) : (
                "Execute"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              disabled={disabled}
              onClick={() => onRequest(action)}
            >
              Request
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              disabled={disabled}
              onClick={() => onEscalate(action)}
            >
              Escalate
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
