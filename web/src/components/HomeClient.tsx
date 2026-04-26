"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDocuments, deleteDocument } from "@/lib/storage";
import type { TaborDoc } from "@/lib/types";
import { LibraryForm } from "./LibraryForm";
import { useTaborStore } from "@/stores/tabor";
import { getSettings } from "@/lib/storage";
import { isAirlockSatisfied } from "@/lib/airlock";

export function HomeClient() {
  const [docs, setDocs] = useState<TaborDoc[]>([]);
  const setFocus = useTaborStore((s) => s.setFocusActive);
  const [air, setAir] = useState<{ need: number; have: number; ok: boolean } | null>(null);

  const refresh = () => {
    void listDocuments().then(setDocs);
  };
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      const a = isAirlockSatisfied(Date.now(), s.airlock);
      setAir({ need: a.need, have: a.have, ok: a.satisfied || !s.airlock.enabled });
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-amber-100">Tabor</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Offline-first PDF reading with a study airlock, focus mode, and optional local AI (Ollama).
        </p>
        {air && !air.ok && (
          <p className="mt-2 text-sm text-amber-500/90">
            Airlock: {air.have}/{air.need} reviews this period — you will see the full gate on next load
            if below target.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-medium text-zinc-300">Add a PDF</h2>
        <LibraryForm afterImport={refresh} />
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={async () => {
            const s = await getSettings();
            setFocus(true);
            void s;
          }}
          className="rounded-lg border border-amber-800/50 bg-amber-950/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-950/60"
        >
          Start focus session
        </button>
        <Link
          href="/settings"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Settings
        </Link>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-300">Your library</h2>
        {docs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No PDFs yet. Import one above (stored in this browser).</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2"
              >
                <div>
                  <Link href={`/reader/${d.id}`} className="text-amber-200 hover:text-amber-100">
                    {d.title}
                  </Link>
                  {d.pageCount && (
                    <span className="ml-2 text-xs text-zinc-600">{d.pageCount} pp.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Remove from this device?")) {
                      await deleteDocument(d.id);
                      refresh();
                    }
                  }}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
