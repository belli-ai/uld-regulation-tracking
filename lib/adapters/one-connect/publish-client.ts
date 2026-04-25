"use client";

import type {
  Loading,
  LogisticsAction,
  LogisticsEvent,
} from "@/lib/ontology/one-record";

type PublishKind = "Loading" | "LogisticsEvent" | "LogisticsAction";

async function send(kind: PublishKind, payload: unknown): Promise<void> {
  try {
    await fetch("/api/one-connect/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
      keepalive: true,
    });
  } catch {
    return;
  }
}

export function publishLoading(loading: Loading): void {
  void send("Loading", loading);
}

export function publishLogisticsEvent(event: LogisticsEvent): void {
  void send("LogisticsEvent", event);
}

export function publishLogisticsAction(action: LogisticsAction): void {
  void send("LogisticsAction", action);
}
