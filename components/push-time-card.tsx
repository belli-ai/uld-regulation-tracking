import { Badge } from "@/components/ui/badge";
import { missionCardClassName } from "@/components/mission-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PushTimeCardData = {
  flightNumber: string | null;
  holdReason: string;
  maxWaitMinutes: number;
  pushTimeLabel: string;
  status: "OK" | "Alert" | "Action in progress" | "Excursion";
  uldId: string;
};

type Props = PushTimeCardData;

function getStatusClassName(status: Props["status"]): string {
  switch (status) {
    case "OK":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "Alert":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "Action in progress":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400";
    case "Excursion":
      return "border-red-500/30 bg-red-500/10 text-red-400";
  }
}

export function PushTimeCard({
  flightNumber,
  holdReason,
  maxWaitMinutes,
  pushTimeLabel,
  status,
  uldId,
}: Props) {
  return (
    <Card className={cn(missionCardClassName)}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Hold / release
            </p>
            <CardTitle className="text-lg font-semibold leading-none">
              {uldId}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-xs font-semibold",
              getStatusClassName(status),
            )}
          >
            {status}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          Flight {flightNumber ?? "unassigned"} · push by {pushTimeLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Current max-wait
            </span>
            <span className="font-mono text-base font-semibold text-foreground">
              {maxWaitMinutes.toFixed(0)} min
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Outbound
            </span>
            <span className="font-mono text-base font-semibold text-foreground">
              {flightNumber ?? "Unassigned"}
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{holdReason}</p>
      </CardContent>
    </Card>
  );
}
