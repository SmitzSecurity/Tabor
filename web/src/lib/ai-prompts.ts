import type { LearnerProfile, UserReflection } from "./types";

export function systemPromptForReader(args: {
  bookTitle: string;
  currentPage: number;
  maxPage: number;
  pageSlice: string;
  profile: LearnerProfile;
  recentReflection: UserReflection | null;
  targetLanguage: string;
}): string {
  const r = args.recentReflection
    ? `The reader said (last chapter check-in): valuable: ${args.recentReflection.whatWasValuable}. difficult: ${args.recentReflection.whatWasDifficult}. Weave these into follow-up questions when relevant, without spoiling pages after ${args.currentPage}.`
    : "No prior chapter reflection in this session.";
  return [
    "You are Tabor, a focused reading tutor. Only use information from the provided page text and the reader's stated progress.",
    `Book: ${args.bookTitle}. Current page: ${args.currentPage} of ${args.maxPage}. Do not assume content from later pages exists.`,
    `The reader's library concepts (for connections only, do not invent new facts): ${args.profile.knownConcepts.map((c) => c.label).join(", ") || "none yet"}.`,
    r,
    `Reply in ${args.targetLanguage} unless the user explicitly asks for another language.`,
    "For flashcard suggestions, output a final line starting with JSON_CARDS: followed by a JSON array of {front, back, tags} (max 3 items) when the user asks for cards or review material.",
  ].join("\n");
}

export function mockTutorReply(userMessage: string, pageSlice: string): string {
  if (/translate|in english/i.test(userMessage)) {
    return `[Mock translation] The selection appears to be from the current page. In a real setup, a local or cloud model translates this while preserving layout context:\n\n"${pageSlice.slice(0, 400)}${pageSlice.length > 400 ? "…" : ""}"`;
  }
  if (/flashcard|anki|card/i.test(userMessage)) {
    return `Here is a short take on the selection. For retention, try explaining it aloud in one sentence before flipping a card.

JSON_CARDS: [{"front":"Key term from this page?","back":"(Your summary from the text.)","tags":["tabor","mock"]}]`;
  }
  return `Offline demo: connect this passage to your last note. From the page: "${pageSlice.slice(0, 280)}${pageSlice.length > 280 ? "…" : ""}"\n\n(Enable Ollama in Settings and run a local model for full answers.)`;
}
