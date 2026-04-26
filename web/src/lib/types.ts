export type TaborDoc = {
  id: string;
  title: string;
  fileKey: string;
  createdAt: number;
  pageCount?: number;
  /** Detected or user-set structure for progressive AI (MVP: manual chapter labels) */
  chapters?: { label: string; startPage: number; endPage: number }[];
};

export type Highlight = {
  id: string;
  docId: string;
  page: number;
  text: string;
  createdAt: number;
};

export type Flashcard = {
  id: string;
  docId: string;
  front: string;
  back: string;
  sourcePage?: number;
  sourceQuote?: string;
  tags: string[];
  createdAt: number;
};

export type UserReflection = {
  id: string;
  docId: string;
  chapterLabel: string;
  whatWasValuable: string;
  whatWasDifficult: string;
  createdAt: number;
};

export type ReadState = {
  docId: string;
  currentPage: number;
  maxPageSeen: number;
  updatedAt: number;
};

export type LearnerProfile = {
  id: "default";
  knownConcepts: { label: string; fromDocId: string; chapterLabel?: string }[];
  openQuestions: string[];
  updatedAt: number;
};

export type AirlockConfig = {
  enabled: boolean;
  /** Require N flashcard reviews to dismiss (simulated in MVP) */
  requiredReviews: number;
  period: "daily" | "8h";
  /** When airlock was last fully satisfied (optional UI) */
  lastSatisfiedAt: number | null;
  /** Counted reviews; reset when `periodKey` does not match current period */
  reviewsThisPeriod: number;
  /** Server-side / client time bucket for the count above */
  periodKey: number;
};

export type FocusConfig = {
  focusTimerMinutes: number;
  /** Pages to flip in focus before showing exit (MVP: manual "page read" clicks) */
  requiredPages: number;
  autoStartOnUnlock: boolean;
  startHour: number; // 0-23, hint for "morning" launch UX copy only in MVP
};

export type AppSettings = {
  airlock: AirlockConfig;
  focus: FocusConfig;
  targetLanguage: string; // e.g. "en"
  sourceHintLanguage: string; // e.g. "de" for translation mock
  ollamaModel: string;
  ollamaBaseUrl: string; // e.g. http://127.0.0.1:11434 when local AI is available
  useOllama: boolean;
};
