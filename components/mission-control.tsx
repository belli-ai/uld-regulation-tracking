"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MissionShellProps = {
  children: ReactNode;
  className?: string;
};

type MissionTopBarProps = {
  actions?: ReactNode;
  eyebrow?: string;
  title: string;
};

type MissionHeroProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
};

type MissionPanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  title?: ReactNode;
};

type MetricTileProps = {
  className?: string;
  label: ReactNode;
  meta?: ReactNode;
  value: ReactNode;
};

type StatusRailProps = {
  children: ReactNode;
  className?: string;
};

const navigationItems = [
  { href: "/", label: "Flights" },
  { href: "/supervisor", label: "Supervisor" },
  { href: "/supervisor/excursions", label: "Excursions" },
  { href: "/supervisor/resolutions", label: "Resolutions" },
  { href: "/admin/config", label: "Admin" },
  { href: "/dev/control", label: "Demo" },
] as const;

export function MissionShell({ children, className }: MissionShellProps) {
  return (
    <div
      className={cn("mission-shell min-h-screen text-foreground", className)}
    >
      {children}
    </div>
  );
}

export function MissionTopBar({ actions, eyebrow, title }: MissionTopBarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="grid min-h-16 w-full gap-3 px-4 py-3 sm:px-6 xl:grid-cols-[minmax(220px,0.35fr)_minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow ? (
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-primary">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="truncate text-base font-semibold uppercase tracking-[0.16em] text-foreground">
            {title}
          </h1>
        </div>
        <nav className="flex min-w-0 flex-wrap items-center gap-1 xl:justify-center">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border border-border/70 bg-background/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/70 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function MissionHero({
  actions,
  children,
  className,
  description,
  eyebrow,
  title,
}: MissionHeroProps) {
  return (
    <section
      className={cn(
        "mission-panel relative overflow-hidden border border-border/80 p-5 shadow-2xl shadow-background/30 md:p-6",
        className,
      )}
    >
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold uppercase tracking-[-0.04em] text-foreground md:text-5xl">
              {title}
            </h2>
            {description ? (
              <p className="max-w-5xl text-base text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {children}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

export function MissionPanel({
  actions,
  children,
  className,
  contentClassName,
  description,
  title,
}: MissionPanelProps) {
  return (
    <Card
      className={cn(
        "mission-panel overflow-hidden border-border/80 shadow-xl shadow-background/20",
        className,
      )}
    >
      {title || description || actions ? (
        <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-muted/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? (
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("p-4 sm:p-5", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function MetricTile({ className, label, meta, value }: MetricTileProps) {
  return (
    <div
      className={cn(
        "mission-tile border border-border/70 bg-background/45 px-4 py-3",
        className,
      )}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-2xl font-bold tracking-[-0.04em] text-foreground">
        {value}
      </div>
      {meta ? (
        <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
      ) : null}
    </div>
  );
}

export function StatusRail({ children, className }: StatusRailProps) {
  return (
    <aside
      className={cn(
        "mission-panel flex flex-col gap-3 border border-border/80 p-4",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export const missionCardClassName =
  "mission-panel border-border/80 shadow-xl shadow-background/20";

export const missionListItemClassName =
  "border border-border/70 bg-background/45 transition-colors hover:border-primary/60 hover:bg-primary/5";
