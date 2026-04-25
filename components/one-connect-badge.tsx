"use client";

import { useOneConnectBootstrap } from "@/lib/hooks/use-one-connect-bootstrap";
import { useOneConnectStore } from "@/lib/stores/one-connect-store";
import { cn } from "@/lib/utils";

/**
 * Small pill showing live/offline status of the 1Neo-Connect tenant.
 * Mounting this also runs the bootstrap (server-info fetch + auto subscribe).
 */
export function OneConnectBadge({ className }: { className?: string }) {
  useOneConnectBootstrap();
  const serverInfo = useOneConnectStore((s) => s.serverInfo);

  if (!serverInfo) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        1Neo-Connect...
      </span>
    );
  }

  if (!serverInfo.enabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
        1Neo-Connect off
      </span>
    );
  }

  const cargoVersion =
    serverInfo.ontology
      .find((iri) => iri.includes("/cargo/"))
      ?.split("/")
      .pop() ?? "-";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      1Neo-Connect · cargo {cargoVersion}
    </span>
  );
}
