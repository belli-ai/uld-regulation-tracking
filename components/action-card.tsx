"use client";

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
}: Props) {
  return (
    <Card className={cn(missionCardClassName)}>
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
        <Button className="w-full sm:flex-1" onClick={() => onExecute(action)}>
          Execute
        </Button>
        <Button
          variant="outline"
          className="w-full sm:flex-1"
          onClick={() => onRequest(action)}
        >
          Request
        </Button>
        <Button
          variant="secondary"
          className="w-full sm:flex-1"
          onClick={() => onEscalate(action)}
        >
          Escalate
        </Button>
      </CardFooter>
    </Card>
  );
}
