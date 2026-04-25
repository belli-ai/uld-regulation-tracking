"use client";

import { useEffect } from "react";
import { useOneConnectStore } from "@/lib/stores/one-connect-store";

const SESSION_FLAG = "one-connect-subscribed-this-session";

type ServerInfoResponse = {
  enabled?: unknown;
  ontology?: unknown;
  hasDataHolder?: unknown;
  lastModified?: unknown;
};

type SubscriptionResponse = {
  created?: unknown;
  skipped?: unknown;
  failed?: unknown;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/**
 * Mount-once hook for client surfaces (supervisor header is enough).
 * Reads server-info; if enabled, POSTs subscriptions exactly once per
 * sessionStorage scope. All errors swallowed — never blocks UI.
 */
export function useOneConnectBootstrap(): void {
  const setServerInfo = useOneConnectStore((s) => s.setServerInfo);
  const setSubscriptionStatus = useOneConnectStore(
    (s) => s.setSubscriptionStatus,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const infoResp = await fetch("/api/one-connect/server-info", {
          cache: "no-store",
        });
        if (!infoResp.ok) return;
        const info = (await infoResp.json()) as ServerInfoResponse;
        if (cancelled) return;
        setServerInfo({
          enabled: Boolean(info.enabled),
          ontology: stringArray(info.ontology),
          hasDataHolder:
            typeof info.hasDataHolder === "string" ? info.hasDataHolder : null,
          lastModified:
            typeof info.lastModified === "string" ? info.lastModified : null,
        });
        if (!info.enabled) return;
        if (sessionStorage.getItem(SESSION_FLAG)) return;
        sessionStorage.setItem(SESSION_FLAG, "1");
        const subResp = await fetch("/api/one-connect/subscriptions", {
          method: "POST",
        });
        if (!subResp.ok) return;
        const sub = (await subResp.json()) as SubscriptionResponse;
        if (cancelled) return;
        setSubscriptionStatus({
          created: stringArray(sub.created),
          skipped: stringArray(sub.skipped),
          failed: stringArray(sub.failed),
        });
      } catch {
        // swallow — connectivity issues are surfaced via the badge
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setServerInfo, setSubscriptionStatus]);
}
