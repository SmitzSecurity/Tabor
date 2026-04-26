"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";

const workerSrc = "/pdf.worker.min.mjs";
if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = workerSrc;
}

type PdfReaderProps = {
  data: ArrayBuffer;
  initialPage: number;
  onPageChange: (page: number) => void;
  onTextForPage: (text: string, page: number) => void;
  onPageCount?: (n: number) => void;
  className?: string;
};

export function PdfReader({
  data,
  initialPage,
  onPageChange,
  onTextForPage,
  onPageCount,
  className,
}: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = getDocument({ data: new Uint8Array(data) }).promise;
        const p = await d;
        if (cancelled) return;
        setPdf(p);
        setTotal(p.numPages);
        onPageCount?.(p.numPages);
        const start = Math.min(Math.max(1, initialPage), p.numPages);
        setPage(start);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to open PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, initialPage, onPageCount]);

  useEffect(() => {
    if (!pdf) return;
    void (async () => {
      if (!pdf || !canvasRef.current) return;
      const p = await pdf.getPage(page);
      const scale = 1.35;
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await p.render({ canvasContext: ctx, canvas, viewport }).promise;
      const textContent = await p.getTextContent();
      const text = textContent.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ");
      onTextForPage(text, page);
    })();
  }, [pdf, page, onTextForPage]);

  const go = (delta: number) => {
    if (!total) return;
    const next = Math.min(Math.max(1, page + delta), total);
    if (next === page) return;
    setPage(next);
    onPageChange(next);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!pdf) {
    return <p className="text-sm text-zinc-500">Loading PDF…</p>;
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Next
        </button>
        <span className="text-sm text-zinc-400">
          Page {page} / {total}
        </span>
      </div>
      <div className="overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
        <canvas ref={canvasRef} className="mx-auto max-w-full" />
      </div>
    </div>
  );
}
