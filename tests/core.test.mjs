import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnkiExport,
  askOfflineTutor,
  buildKnowledgeProfile,
  buildFocusState,
  createFlashcard,
  generateChapterQuiz,
  readingLibrary,
  suggestLearningArtifacts,
  translateText
} from "../src/core.js";

const progress = {
  completedChapterIds: ["atomic-habits-1"],
  currentChapterId: "deep-work-1"
};

test("knowledge profile avoids future chapter concepts", () => {
  const profile = buildKnowledgeProfile(readingLibrary, progress);

  assert.equal(profile.chaptersRead, 1);
  assert.equal(profile.knownConcepts.some((item) => item.concept === "focus ritual"), true);
  assert.equal(profile.lockedConcepts.includes("automatic translation"), true);
  assert.doesNotMatch(profile.summary, /automatic translation/);
});

test("assistant response uses only visible reading context", () => {
  const response = askOfflineTutor({
    prompt: "What was difficult and valuable?",
    chapter: readingLibrary[0].chapters[1],
    progress,
    library: readingLibrary
  });

  assert.match(response.text, /focus ritual/);
  assert.match(response.text, /compound habit growth/);
  assert.doesNotMatch(response.text, /automatic translation/);
});

test("suggested artifacts create highlights, notes, and flashcards", () => {
  const artifacts = suggestLearningArtifacts(readingLibrary[0].chapters[1], progress, readingLibrary);

  assert.equal(artifacts.highlights.length, 1);
  assert.match(artifacts.notes[1], /compound habit growth/);
  assert.match(artifacts.flashcards[0].front, /chapter synthesis/);
  assert.match(artifacts.flashcards[0].back, /focus ritual/);
});

test("Anki export escapes tabs and newlines", () => {
  const output = buildAnkiExport([
    createFlashcard("Front\twith tab", "Back\nwith newline", "Chapter 1")
  ]);

  assert.equal(output, "Front with tab\tBack with newline\tTabor::Chapter 1\t");
});

test("focus state locks until duration, pages, and cards are met", () => {
  const locked = buildFocusState({
    focusStartedAt: 0,
    now: 60_000,
    requiredMinutes: 5,
    pagesFlipped: 1,
    requiredPages: 3,
    cardsReviewed: 2,
    requiredCards: 5
  });

  assert.equal(locked.locked, true);
  assert.deepEqual(locked.missing, ["4 more minute(s)", "2 more page(s)", "3 more card(s)"]);

  const unlocked = buildFocusState({
    focusStartedAt: 0,
    now: 6 * 60_000,
    requiredMinutes: 5,
    pagesFlipped: 3,
    requiredPages: 3,
    cardsReviewed: 5,
    requiredCards: 5
  });

  assert.equal(unlocked.locked, false);
});

test("translation preview localizes supported non-English excerpts", () => {
  const output = translateText(readingLibrary[0].chapters[2].text);

  assert.match(output, /Active reading turns every page into a conversation/);
  assert.match(output, /key ideas for later review/);
});

test("chapter quiz connects new chapter to prior known material only", () => {
  const quiz = generateChapterQuiz(readingLibrary[0].chapters[1], progress, readingLibrary);

  assert.equal(quiz.some((question) => question.includes("compound habit growth")), true);
  assert.equal(quiz.some((question) => question.includes("automatic translation")), false);
});
