import type { Flashcard } from "./types";

/** Plain text for Anki import: one card per line, front\\tback\\ttags (optional third field) */
export function toAnkiTsvText(cards: Flashcard[], deckName = "Tabor::Imported"): string {
  const header = [
    "#separator:Tab",
    "#html:false",
    `# deck: ${deckName}`,
  ].join("\n");
  const body = cards
    .map((c) => {
      const t = c.tags.length ? c.tags.join(" ") : "tabor";
      const f = c.front.replace(/\n/g, " ").replace(/\t/g, " ");
      const b = c.back.replace(/\n/g, " ").replace(/\t/g, " ");
      return `${f}\t${b}\t${t}`;
    })
    .join("\n");
  return `${header}\n${body}\n`;
}

export function downloadAnkiText(cards: Flashcard[], filename: string) {
  const tsv = toAnkiTsvText(cards);
  const blob = new Blob([tsv], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".txt") ? filename : `${filename}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
