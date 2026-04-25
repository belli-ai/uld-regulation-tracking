"use client";

import { useEffect } from "react";
import { notFound, useRouter } from "next/navigation";

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
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="text-base text-muted-foreground">Redirecting to demo control...</div>
    </div>
  );
}
