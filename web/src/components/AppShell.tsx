"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/lib/storage";
import { isAirlockSatisfied } from "@/lib/airlock";
import { useTaborStore } from "@/stores/tabor";
import { AirlockPanel } from "./AirlockPanel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { airlockOpen, setAirlockOpen } = useTaborStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      if (!s.airlock.enabled || isAirlockSatisfied(Date.now(), s.airlock).satisfied) {
        setAirlockOpen(true);
      } else {
        setAirlockOpen(false);
      }
      setReady(true);
    })();
  }, [setAirlockOpen]);

  const show = ready && !airlockOpen;
  return (
    <>
      {children}
      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="airlock-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-amber-900/50 bg-zinc-950 p-6 shadow-2xl">
            <h2 id="airlock-title" className="text-center text-xl font-semibold text-amber-100">
              Airlock
            </h2>
            <p className="mt-1 text-center text-sm text-zinc-500">
              Short reviews before the rest of the app unlocks. MVP simulates the daily card gate.
            </p>
            <div className="mt-6">
              <AirlockPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
