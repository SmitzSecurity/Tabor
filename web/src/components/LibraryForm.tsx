"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveNewDocument } from "@/lib/storage";

type Props = { afterImport?: (docId: string) => void };

export function LibraryForm({ afterImport }: Props) {
  const r = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        try {
          const doc = await saveNewDocument(file, title || undefined);
          r.push(`/reader/${doc.id}`);
          afterImport?.(doc.id);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setFile(f ?? null);
        }}
        className="text-sm"
      />
      <input
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
      />
      <button
        type="submit"
        disabled={!file || busy}
        className="rounded-md bg-amber-600 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import and open"}
      </button>
    </form>
  );
}
