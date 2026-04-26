import { get, set, del, keys, createStore } from "idb-keyval";
import type { TaborDoc, Highlight, Flashcard, UserReflection, ReadState, LearnerProfile, AppSettings } from "./types";
import { defaultAppSettings } from "./defaults";
import { normalizeAirlock } from "./airlock";

const s = createStore("tabor-db", "tabor");

const k = {
  books: "meta:books",
  settings: "settings:v1",
  readPrefix: (docId: string) => `read:${docId}`,
  highlightsPrefix: (docId: string) => `highlights:${docId}`,
  file: (id: string) => `file:${id}`,
  profile: "learner:profile",
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function listDocuments(): Promise<TaborDoc[]> {
  const v = await get<TaborDoc[] | undefined>(k.books, s);
  return v?.slice().sort((a, b) => b.createdAt - a.createdAt) ?? [];
}

export async function getDocument(id: string): Promise<TaborDoc | undefined> {
  const all = await listDocuments();
  return all.find((d) => d.id === id);
}

export async function updateDocument(
  id: string,
  patch: Partial<Pick<TaborDoc, "title" | "pageCount" | "chapters">>
): Promise<TaborDoc | undefined> {
  const list = await listDocuments();
  const i = list.findIndex((d) => d.id === id);
  if (i === -1) return undefined;
  list[i] = { ...list[i]!, ...patch } as TaborDoc;
  await set(k.books, list, s);
  return list[i];
}

export async function saveNewDocument(
  file: File,
  title?: string
): Promise<TaborDoc> {
  const id = uid();
  const ab = await file.arrayBuffer();
  const doc: TaborDoc = {
    id,
    title: title || file.name.replace(/\.(pdf|PDF)$/, "") || "Untitled",
    fileKey: k.file(id),
    createdAt: Date.now(),
  };
  await set(k.file(id), ab, s);
  const list = await listDocuments();
  list.push(doc);
  await set(k.books, list, s);
  return doc;
}

export async function getPdfArrayBuffer(docId: string): Promise<ArrayBuffer | undefined> {
  const doc = await getDocument(docId);
  if (!doc) return undefined;
  return get<ArrayBuffer | undefined>(doc.fileKey, s);
}

export async function deleteDocument(id: string): Promise<void> {
  await del(k.file(id), s);
  await del(k.readPrefix(id), s);
  await del(k.highlightsPrefix(id), s);
  const list = (await listDocuments()).filter((d) => d.id !== id);
  await set(k.books, list, s);
}

export async function getReadState(docId: string): Promise<ReadState> {
  const d = await get<ReadState | undefined>(k.readPrefix(docId), s);
  return d ?? { docId, currentPage: 1, maxPageSeen: 1, updatedAt: Date.now() };
}

export async function setReadState(state: ReadState): Promise<void> {
  await set(
    k.readPrefix(state.docId),
    { ...state, updatedAt: Date.now() },
    s
  );
}

export async function getHighlights(docId: string): Promise<Highlight[]> {
  return (await get<Highlight[] | undefined>(k.highlightsPrefix(docId), s)) ?? [];
}

export async function addHighlight(h: Omit<Highlight, "id" | "createdAt">): Promise<Highlight> {
  const all = await getHighlights(h.docId);
  const item: Highlight = { ...h, id: uid(), createdAt: Date.now() };
  all.push(item);
  await set(k.highlightsPrefix(h.docId), all, s);
  return item;
}

const flashKey = "flashcards:all";
export async function listFlashcards(): Promise<Flashcard[]> {
  return (await get<Flashcard[] | undefined>(flashKey, s)) ?? [];
}

export async function addFlashcards(
  items: Omit<Flashcard, "id" | "createdAt">[]
): Promise<Flashcard[]> {
  const all = await listFlashcards();
  const out: Flashcard[] = items.map((i) => ({
    ...i,
    id: uid(),
    createdAt: Date.now(),
  }));
  all.push(...out);
  await set(flashKey, all, s);
  return out;
}

const DEMO_KEY = "meta:demo-seeded";
export async function ensureDemoFlashcardsIfEmpty(): Promise<void> {
  const all = await listFlashcards();
  if (all.length > 0) return;
  const did = await get<boolean | undefined>(DEMO_KEY, s);
  if (did) return;
  await addFlashcards(
    [1, 2, 3, 4, 5].map((i) => ({
      docId: "demo",
      front: `Demo card ${i}: what is active recall?`,
      back: "Bringing a fact to mind from memory, without the text in front of you.",
      tags: ["tabor:demo", "tabor:airlock"],
      sourcePage: undefined,
      sourceQuote: undefined,
    }))
  );
  await set(DEMO_KEY, true, s);
}

const reflectionsKey = "reflections:all";
export async function addReflection(
  r: Omit<UserReflection, "id" | "createdAt">
): Promise<UserReflection> {
  const all = (await get<UserReflection[] | undefined>(reflectionsKey, s)) ?? [];
  const item: UserReflection = { ...r, id: uid(), createdAt: Date.now() };
  all.push(item);
  await set(reflectionsKey, all, s);
  return item;
}

export async function listReflectionsForDoc(docId: string): Promise<UserReflection[]> {
  const all = (await get<UserReflection[] | undefined>(reflectionsKey, s)) ?? [];
  return all.filter((r) => r.docId === docId);
}

export async function getLearnerProfile(): Promise<LearnerProfile> {
  return (
    (await get<LearnerProfile | undefined>(k.profile, s)) ?? {
      id: "default",
      knownConcepts: [],
      openQuestions: [],
      updatedAt: Date.now(),
    }
  );
}

export async function setLearnerProfile(p: LearnerProfile): Promise<void> {
  await set(k.profile, p, s);
}

export async function getSettings(): Promise<AppSettings> {
  const base = (await get<AppSettings | undefined>(k.settings, s)) ?? defaultAppSettings();
  return { ...base, airlock: normalizeAirlock(base.airlock, Date.now()) };
}

export async function setSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const cur = (await get<AppSettings | undefined>(k.settings, s)) ?? defaultAppSettings();
  const next = { ...cur, ...partial } as AppSettings;
  if (partial.airlock) next.airlock = { ...cur.airlock, ...partial.airlock };
  if (partial.focus) next.focus = { ...cur.focus, ...partial.focus };
  next.airlock = normalizeAirlock(next.airlock, Date.now());
  await set(k.settings, next, s);
  return next;
}

/** Dev / repair: list all idb keys in our store (not exported in prod use) */
export async function _debugKeyCount() {
  return (await keys(s)).length;
}
