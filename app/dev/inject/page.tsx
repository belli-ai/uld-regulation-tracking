"use client";

import { useEffect } from "react";
import { notFound, useRouter } from "next/navigation";

import { MissionShell } from "@/components/mission-control";
import { isDemoMode } from "@/lib/env";

export default function DevInjectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dev/control");
  }, [router]);

  if (!isDemoMode) {
    return notFound();
  }

  return (
    <MissionShell className="flex items-center justify-center">
      <div className="text-base text-muted-foreground">
        Redirecting to demo control...
      </div>
    </MissionShell>
  );
}
