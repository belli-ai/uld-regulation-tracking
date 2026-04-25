'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type BudgetForecast = {
  breachAt: string | null;
  budgetH: number;
  warning: 'green' | 'yellow' | 'red';
};

type Props = {
  forecast: BudgetForecast | null;
  hasPieces: boolean;
};

function ToneIcon({ tone }: { tone: 'green' | 'yellow' | 'red' }) {
  if (tone === 'green') {
    return <CheckCircle2 className="text-emerald-400" />;
  }
  if (tone === 'red') {
    return <XCircle className="text-red-400" />;
  }
  return <AlertTriangle className="text-amber-400" />;
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export function BudgetPreflightRow({ forecast, hasPieces }: Props) {
  const tone = !hasPieces || forecast === null ? 'yellow' : forecast.warning;

  return (
    <Card
      className={cn(
        'border-border/80',
        tone === 'red' && 'border-red-500/60',
        tone === 'yellow' && 'border-amber-500/60',
        tone === 'green' && 'border-emerald-500/60',
      )}
    >
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ToneIcon tone={tone} />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">Budget preflight</CardTitle>
              <CardDescription className="text-sm md:text-base">
                {!hasPieces || forecast === null
                  ? 'Waiting for contents and projected ambient.'
                  : forecast.warning === 'red'
                    ? 'Projected exposure exceeds the safe operating budget.'
                    : forecast.warning === 'yellow'
                      ? 'Thermal budget is tight against the next 24 hours.'
                      : 'Projected ambient stays within the thermal envelope.'}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={
              tone === 'red'
                ? 'destructive'
                : tone === 'green'
                  ? 'default'
                  : 'secondary'
            }
            className="min-h-7"
          >
            {tone === 'green' ? 'Green' : tone === 'red' ? 'Red' : 'Yellow'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm md:text-base">
        {forecast ? (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
              Remaining thermal budget: <span className="font-semibold">{formatHours(forecast.budgetH)}h</span>
            </div>
            {forecast.breachAt ? (
              <div className="text-sm text-muted-foreground">
                Predicted breach at {new Date(forecast.breachAt).toLocaleString()}.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No modeled breach inside the forecast window.
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            The thermal forecast will appear after the first accepted drop.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
