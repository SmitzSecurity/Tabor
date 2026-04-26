"use client";

import { useCallback, useEffect, startTransition, useState } from "react";
import Link from "next/link";
import { PdfReader } from "@/components/PdfReader";
import { ChapterCheckIn, ReaderChat } from "@/components/ReaderChat";
import { downloadAnkiText } from "@/lib/anki";
import {
  addHighlight,
  getDocument,
  getHighlights,
  getPdfArrayBuffer,
  getReadState,
  listFlashcards,
  listReflectionsForDoc,
  setReadState,
  updateDocument,
} from "@/lib/storage";
import { useTaborStore } from "@/stores/tabor";
import type { Flashcard, Highlight, UserReflection } from "@/lib/types";

type Props = { docId: string };

export function ReadClient({ docId }: Props) {
  const incFocus = useTaborStore((s) => s.incFocusPage);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState("…");
  const [maxPage, setMaxPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [text, setText] = useState("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [forExport, setForExport] = useState<Flashcard[]>([]);
  const [lastRef, setLastRef] = useState<UserReflection | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await getDocument(docId);
      if (d) {
        setTitle(d.title);
        if (d.pageCount) setMaxPage(d.pageCount);
      }
      const a = await getPdfArrayBuffer(docId);
      setBuf(a ?? null);
      const rs = await getReadState(docId);
      setCurrentPage(rs.currentPage);
      if (rs.maxPageSeen) setMaxPage((m) => Math.max(m, rs.maxPageSeen));
    })();
  }, [docId]);

  const refresh = useCallback(async () => {
    setHighlights(await getHighlights(docId));
    const all = (await listFlashcards()).filter((c) => c.docId === docId);
    setForExport(all);
    const ref = (await listReflectionsForDoc(docId)).sort((a, b) => a.createdAt - b.createdAt);
    setLastRef(ref.length ? ref[ref.length - 1]! : null);
  }, [docId]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh, docId]);

  const onPageChange = useCallback(
    (p: number) => {
      setCurrentPage(p);
      setMaxPage((m) => {
        const nextM = Math.max(m, p);
        void setReadState({
          docId,
          currentPage: p,
          maxPageSeen: nextM,
          updatedAt: Date.now(),
        });
        return nextM;
      });
      if (useTaborStore.getState().focusActive) {
        incFocus();
      }
    },
    [docId, incFocus]
  );

  const onText = useCallback((t: string) => {
    setText(t);
  }, []);

  if (!buf) {
    return (
      <p className="p-4 text-sm text-zinc-500">
        Loading document… or not found.{" "}
        <Link className="text-amber-400 underline" href="/">
          Library
        </Link>
      </p>
    );
  }

  return (
    <div className="min-h-dvh p-4 md:grid md:min-h-0 md:grid-cols-[1fr,min(30rem,100%)] md:gap-6">
      <div>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h1 className="truncate text-lg font-medium text-amber-100/90">{title}</h1>
          <div className="shrink-0 space-x-2 text-sm">
            <button
              type="button"
              onClick={() => forExport.length && downloadAnkiText(forExport, `${title}-tabor.txt`)}
              className="text-amber-500 hover:text-amber-400"
            >
              Anki TSV
            </button>
            <Link href="/" className="text-zinc-500 hover:text-zinc-300">
              Library
            </Link>
          </div>
        </header>
        <PdfReader
          data={buf}
          initialPage={currentPage}
          onPageChange={onPageChange}
          onTextForPage={onText}
          onPageCount={(n) => {
            setMaxPage(n);
            void updateDocument(docId, { pageCount: n });
          }}
        />
        <p className="mt-2 text-center text-xs text-zinc-600">
          In focus mode, each Next or Prev is counted as a page for the focus gate.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!text.trim()) return;
              await addHighlight({ docId, page: currentPage, text: text.slice(0, 2000) });
              void refresh();
            }}
            className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Save page text as highlight
          </button>
        </div>
        {highlights.length > 0 && (
          <ul className="mt-2 max-h-32 overflow-auto text-xs text-zinc-500">
            {highlights.map((h) => (
              <li key={h.id}>
                p.{h.page} — {h.text.slice(0, 100)}…
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside className="mt-6 flex flex-col gap-4 border-t border-zinc-800 pt-6 md:mt-0 md:border-t-0 md:pt-0">
        <ReaderChat
          docId={docId}
          bookTitle={title}
          pageText={text}
          currentPage={currentPage}
          maxPage={maxPage}
          lastReflection={lastRef}
        />
        <ChapterCheckIn docId={docId} pageLabel={`p.${currentPage}`} onSaved={() => void refresh()} />
      </aside>
    </div>
  );
}
