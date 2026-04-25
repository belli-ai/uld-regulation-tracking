"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setScenarioAnchorMs } from "@/lib/clock/scenario-anchor";
import { auditDb } from "@/lib/persistence/audit-db";
import { useDemoClockStore } from "@/lib/stores/demo-clock-store";

const SESSION_PREFIX = "cool-chain:";

async function clearAuditDb(): Promise<void> {
  try {
    await Promise.all([
      auditDb.events.clear(),
      auditDb.actions.clear(),
      auditDb.loadings.clear(),
      auditDb.uldStatus.clear(),
    ]);
  } catch (error) {
    console.warn("[reset] failed to clear auditDb", error);
  }
}

function clearSessionStorage(): void {
  if (typeof sessionStorage === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(SESSION_PREFIX)) keys.push(key);
  }
  for (const key of keys) sessionStorage.removeItem(key);
}

function clearLocalStoragePrefs(): void {
  if (typeof localStorage === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (
      key &&
      key.startsWith(SESSION_PREFIX) &&
      key !== "cool-chain:scenario-anchor-ms"
    ) {
      keys.push(key);
    }
  }
  for (const key of keys) localStorage.removeItem(key);
}

export function ResetButton() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleReset() {
    setRunning(true);
    try {
      await clearAuditDb();
      clearSessionStorage();
      clearLocalStoragePrefs();
      setScenarioAnchorMs(Date.now());
      useDemoClockStore.getState().reset();
      window.location.reload();
    } catch (error) {
      console.error("[reset] failed", error);
      setRunning(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed bottom-6 right-44 z-50">
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="pointer-events-auto h-12 gap-2 px-5 font-mono shadow-lg"
          onClick={() => setOpen(true)}
        >
          <RotateCcw className="size-4" /> Reset
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5" /> Reset demo state
            </DialogTitle>
            <DialogDescription>
              Wipes audit DB (loadings, events, actions, uldStatus), session
              storage, and demo prefs. Re-anchors flight times to{" "}
              <span className="font-mono">now+2.5h / +4h / +6h / +7.5h</span>{" "}
              and reloads. The page will refresh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={running}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleReset()}
              disabled={running}
            >
              {running ? "Resetting…" : "Reset & reload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
