"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/lib/storage";
import { useTaborStore } from "@/stores/tabor";

export function FocusOverlay() {
  const { focusActive, setFocusActive, focusPagesRead, requiredPages, setRequiredPages } = useTaborStore();
  const [left, setLeft] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setRequiredPages(s.focus.requiredPages);
      setLeft(s.focus.focusTimerMinutes * 60);
      setReady(true);
    })();
  }, [setRequiredPages]);

  useEffect(() => {
    if (!focusActive || !ready) return;
    const t = setInterval(() => {
      setLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [focusActive, ready]);

  const canExit = focusPagesRead >= requiredPages || left <= 0;
  if (!focusActive) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-between bg-zinc-950/95 p-4 backdrop-blur"
      role="dialog"
      aria-label="Focus mode"
    >
      <div>
        <p className="text-sm font-medium text-amber-200">Focus mode</p>
        <p className="text-xs text-zinc-500">
          Read {Math.min(focusPagesRead, requiredPages)}/{requiredPages} pages (manual advance) or wait for
          the timer. On mobile, use OS app pinning in addition to this.
        </p>
      </div>
      <div className="text-center">
        <p className="text-4xl font-mono text-zinc-200">
          {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </p>
        <p className="mt-2 text-sm text-zinc-500">Timer is a soft guard; page count is the main gate in MVP.</p>
      </div>
      {canExit ? (
        <button
          type="button"
          onClick={() => setFocusActive(false)}
          className="w-full rounded-lg bg-amber-600 py-3 text-sm font-medium text-white hover:bg-amber-500"
        >
          End focus
        </button>
      ) : (
        <p className="text-center text-sm text-zinc-500">Flip {requiredPages - focusPagesRead} more page(s) in the reader…</p>
      )}
    </div>
  );
}
