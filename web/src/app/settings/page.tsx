"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSettings, setSettings } from "@/lib/storage";
import type { AppSettings } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { useTaborStore } from "@/stores/tabor";

export default function SettingsPage() {
  const [s, setS] = useState<AppSettings | null>(null);
  const setRequiredPages = useTaborStore((x) => x.setRequiredPages);

  useEffect(() => {
    void getSettings().then(setS);
  }, []);

  if (!s) {
    return <p className="p-6 text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-amber-100">Settings</h1>
          <Link href="/" className="text-sm text-amber-500/90 hover:text-amber-400">
            Library
          </Link>
        </div>
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Local AI (Ollama)</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={s.useOllama}
              onChange={(e) => void setSettings({ useOllama: e.target.checked }).then(setS)}
            />
            Use Ollama when available
          </label>
          <div>
            <label className="text-xs text-zinc-500">Base URL</label>
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={s.ollamaBaseUrl}
              onChange={(e) => {
                const v = e.target.value;
                setS((cur) => (cur ? { ...cur, ollamaBaseUrl: v } : cur));
              }}
              onBlur={() => void setSettings({ ollamaBaseUrl: s.ollamaBaseUrl }).then(setS)}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Model</label>
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={s.ollamaModel}
              onChange={(e) => {
                const v = e.target.value;
                setS((cur) => (cur ? { ...cur, ollamaModel: v } : cur));
              }}
              onBlur={() => void setSettings({ ollamaModel: s.ollamaModel }).then(setS)}
            />
          </div>
        </section>
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Airlock</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={s.airlock.enabled}
              onChange={(e) => void setSettings({ airlock: { ...s.airlock, enabled: e.target.checked } }).then(setS)}
            />
            Require local reviews to open the app
          </label>
          <div>
            <label className="text-xs text-zinc-500">Reviews per period</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={s.airlock.requiredReviews}
              onChange={(e) =>
                setS((cur) =>
                  cur
                    ? {
                        ...cur,
                        airlock: { ...cur.airlock, requiredReviews: Number(e.target.value) || 1 },
                      }
                    : cur
                )
              }
              onBlur={() => void setSettings({ airlock: s.airlock }).then(setS)}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Period</label>
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={s.airlock.period}
              onChange={(e) =>
                void setSettings({ airlock: { ...s.airlock, period: e.target.value as "daily" | "8h" } }).then(setS)
              }
            >
              <option value="daily">Daily</option>
              <option value="8h">Every 8 hours</option>
            </select>
          </div>
        </section>
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Focus (soft gate in MVP)</h2>
          <div>
            <label className="text-xs text-zinc-500">Timer (minutes)</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={s.focus.focusTimerMinutes}
              onChange={(e) =>
                setS((cur) =>
                  cur
                    ? { ...cur, focus: { ...cur.focus, focusTimerMinutes: Number(e.target.value) || 1 } }
                    : cur
                )
              }
              onBlur={() => void setSettings({ focus: s.focus }).then(setS)}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Pages to flip (in reader) before exit</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={s.focus.requiredPages}
              onChange={(e) =>
                setS((cur) =>
                  cur ? { ...cur, focus: { ...cur.focus, requiredPages: Number(e.target.value) || 1 } } : cur
                )
              }
              onBlur={() =>
                void setSettings({ focus: s.focus }).then((next) => {
                  setS(next);
                  setRequiredPages(next.focus.requiredPages);
                })
              }
            />
          </div>
        </section>
        <p className="text-xs text-zinc-600">
          PDFs, highlights, and cards are stored in IndexedDB in this browser. Install as PWA (future) for a
          more app-like default opener on desktop.
        </p>
      </div>
    </AppShell>
  );
}
