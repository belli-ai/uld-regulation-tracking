"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  actionLabel: string;
  category: string;
  claimedBenefitHours: number;
  measuredBenefitHours: number;
};

type Props = {
  points: Point[];
};

export function BenefitScatterChart({ points }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        No claimed-vs-actual benefit pairs are available yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="claimedBenefitHours"
          name="Claimed"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          unit="h"
        />
        <YAxis
          type="number"
          dataKey="measuredBenefitHours"
          name="Actual"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          unit="h"
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            color: "var(--foreground)",
          }}
        />
        <Scatter data={points} fill="var(--primary)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
