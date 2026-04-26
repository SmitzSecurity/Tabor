"use client";

import { useState } from "react";
import { addFlashcards, addReflection, getLearnerProfile, getSettings, setLearnerProfile } from "@/lib/storage";
import type { UserReflection } from "@/lib/types";

type ReaderChatProps = {
  docId: string;
  bookTitle: string;
  pageText: string;
  currentPage: number;
  maxPage: number;
  lastReflection: UserReflection | null;
};

export function ReaderChat({
  docId,
  bookTitle,
  pageText,
  currentPage,
  maxPage,
  lastReflection,
}: ReaderChatProps) {
  const [q, setQ] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setOut(null);
    try {
      const profile = await getLearnerProfile();
      const settings = await getSettings();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          pageSlice: pageText.slice(0, 8000),
          bookTitle,
          currentPage,
          maxPage,
          useOllama: settings.useOllama,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          ollamaModel: settings.ollamaModel,
          targetLanguage: settings.targetLanguage,
          profile,
          reflection: lastReflection,
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        cards?: { front: string; back: string; tags: string[] }[];
        error?: string;
      };
      const text = (data.error ? `${data.error}\n\n` : "") + (data.content ?? "");
      setOut(text);
      if (data.cards && data.cards.length) {
        await addFlashcards(
          data.cards.map((c) => ({
            docId,
            front: c.front,
            back: c.back,
            tags: c.tags,
            sourcePage: currentPage,
            sourceQuote: pageText.slice(0, 200),
          }))
        );
      }
    } catch (e) {
      setOut(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">Ask the tutor (typed)</label>
      <textarea
        className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 p-2 text-sm text-zinc-100"
        rows={2}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Summarize this page, or ask for a flashcard…"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
      {out && (
        <p className="whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-sm text-zinc-200">
          {out}
        </p>
      )}
    </div>
  );
}

export function ChapterCheckIn({
  docId,
  pageLabel,
  onSaved,
}: {
  docId: string;
  pageLabel: string;
  onSaved?: () => void;
}) {
  const [v, setV] = useState("");
  const [d, setD] = useState("");
  const [ok, setOk] = useState(false);

  if (ok) {
    return (
      <p className="text-sm text-emerald-400/90">
        Noted. The next chapter&apos;s questions can use this.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <p className="text-xs font-medium uppercase text-zinc-500">Check-in (after a section)</p>
      <input
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="What was most valuable here?"
      />
      <input
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
        value={d}
        onChange={(e) => setD(e.target.value)}
        placeholder="What was difficult?"
      />
      <button
        type="button"
        onClick={async () => {
          if (!v.trim() && !d.trim()) return;
          await addReflection({ docId, chapterLabel: pageLabel, whatWasValuable: v, whatWasDifficult: d });
          const p = await getLearnerProfile();
          const add = (label: string) => ({ label, fromDocId: docId, chapterLabel: pageLabel });
          await setLearnerProfile({
            ...p,
            knownConcepts: [
              ...p.knownConcepts,
              ...(v.trim() ? [add(`Valuable: ${v.slice(0, 120)}`)] : []),
              ...(d.trim() ? [add(`Difficult: ${d.slice(0, 120)}`)] : []),
            ],
            openQuestions: d.trim() ? [...p.openQuestions, d.slice(0, 200)] : p.openQuestions,
            updatedAt: Date.now(),
          });
          setOk(true);
          onSaved?.();
        }}
        className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
      >
        Save to timeline
      </button>
    </div>
  );
}
