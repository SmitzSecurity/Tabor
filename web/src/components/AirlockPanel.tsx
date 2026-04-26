"use client";

import { useCallback, useEffect, startTransition, useState } from "react";
import {
  addFlashcards,
  ensureDemoFlashcardsIfEmpty,
  getSettings,
  listFlashcards,
  setSettings,
} from "@/lib/storage";
import { nextAirlockAfterReview, isAirlockSatisfied } from "@/lib/airlock";
import { useTaborStore } from "@/stores/tabor";
import type { Flashcard } from "@/lib/types";

export function AirlockPanel() {
  const { setAirlockOpen } = useTaborStore();
  const [due, setDue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [back, setBack] = useState(false);
  const [need, setNeed] = useState(0);
  const [have, setHave] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [satisfied, setSatisfied] = useState(true);

  const load = useCallback(async () => {
    await ensureDemoFlashcardsIfEmpty();
    const settings = await getSettings();
    if (!settings.airlock.enabled) {
      setSatisfied(true);
      setAirlockOpen(true);
      return;
    }
    const s = isAirlockSatisfied(Date.now(), settings.airlock);
    setNeed(s.need);
    setHave(s.have);
    setSatisfied(s.satisfied);
    if (s.satisfied) {
      setAirlockOpen(true);
      return;
    }
    const all = (await listFlashcards()).filter((c) => c.tags.some((t) => t.startsWith("tabor")));
    setDue(all.length > 0 ? all : []);
    setIndex(0);
    setBack(false);
  }, [setAirlockOpen]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  const current = due[index % (due.length || 1)];

  const onCountedReview = async () => {
    setDisabled(true);
    const settings = await getSettings();
    const next = nextAirlockAfterReview(Date.now(), settings.airlock);
    await setSettings({ airlock: next });
    const s = isAirlockSatisfied(Date.now(), next);
    setNeed(s.need);
    setHave(s.have);
    if (s.satisfied) {
      setSatisfied(true);
      setAirlockOpen(true);
      setDisabled(false);
      return;
    }
    setIndex((i) => i + 1);
    setBack(false);
    setDisabled(false);
  };

  if (satisfied) {
    return (
      <div className="text-center text-zinc-300">
        <p className="text-lg">Airlock is clear. You can open the library.</p>
        <button
          type="button"
          onClick={() => setAirlockOpen(true)}
          className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          Continue
        </button>
      </div>
    );
  }

  if (due.length === 0) {
    return (
      <div className="space-y-3 text-sm text-zinc-400">
        <p>No tabor-tagged cards yet. Seed a demo or create cards from the reader.</p>
        <button
          type="button"
          onClick={async () => {
            await addFlashcards([
              {
                docId: "airlock",
                front: "What is spaced repetition?",
                back: "Reviewing on expanding intervals to move knowledge into long-term memory.",
                tags: ["tabor:airlock"],
                sourcePage: undefined,
                sourceQuote: undefined,
              },
            ]);
            await load();
          }}
          className="rounded-md border border-zinc-600 px-3 py-1.5 text-amber-300 hover:bg-zinc-800"
        >
          Add demo card
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-xs text-zinc-500">
        Reviews {have} / {need} this period — tap the card, then mark review
      </p>
      <button
        type="button"
        onClick={() => setBack((b) => !b)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 p-6 text-left shadow-lg min-h-[140px] hover:border-amber-700/50"
      >
        <p className="text-xs uppercase tracking-wide text-amber-600/80">
          {back ? "Back" : "Front"}
        </p>
        <p className="mt-2 text-zinc-100">{back ? current.back : current.front}</p>
      </button>
      {back && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onCountedReview()}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Count review
          </button>
        </div>
      )}
      {!back && <p className="mt-3 text-center text-xs text-zinc-500">Tap card to reveal</p>}
    </div>
  );
}
