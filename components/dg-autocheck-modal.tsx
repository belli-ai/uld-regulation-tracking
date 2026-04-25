"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDgAutocheckStore } from "@/lib/stores/dg-autocheck-store";

type Props = {
  acceptanceCheckId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function formatRemaining(expiresAt?: string): string {
  if (!expiresAt) {
    return "URL expiry pending";
  }

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "URL expired";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
}

export function DgAutocheckModal({
  acceptanceCheckId,
  onOpenChange,
  open,
}: Props) {
  const [, setClock] = useState(0);
  const entry = useDgAutocheckStore((state) =>
    acceptanceCheckId
      ? state.byAcceptanceCheckId[acceptanceCheckId]
      : undefined,
  );
  const remaining = formatRemaining(entry?.requestedUrlExpiresAt);

  useEffect(() => {
    if (!open) {
      return;
    }

    const id = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck />
            DG AutoCheck
          </DialogTitle>
          <DialogDescription>
            Complete the vendor documentation and packaging check for this DG
            piece.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{entry?.vendorStatus ?? entry?.status ?? "pending"}</span>
          <span>{remaining}</span>
        </div>

        {entry?.requestedUrl ? (
          <iframe
            className="h-[68dvh] w-full border border-border bg-background"
            src={entry.requestedUrl}
            title="DG AutoCheck acceptance check"
          />
        ) : (
          <div className="flex h-[50dvh] items-center justify-center border border-border bg-muted/30">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="animate-spin" />
              Waiting for DG AutoCheck session URL
            </div>
          </div>
        )}

        <DialogFooter>
          {entry?.requestedUrl ? (
            <Button type="button" variant="outline" asChild>
              <a href={entry.requestedUrl} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" />
                Open in new tab
              </a>
            </Button>
          ) : null}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
