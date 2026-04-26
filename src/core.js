export const readingLibrary = [
  {
    id: "atomic-habits",
    title: "Atomic Habits + Deep Work Sampler",
    author: "Tabor demo library",
    chapters: [
      {
        id: "atomic-habits-1",
        title: "Atomic Habits: Tiny Compounding",
        order: 1,
        pages: 4,
        language: "English",
        text:
          "Habits are the compound interest of self-improvement. Tiny changes look small at first, but repeated choices multiply into meaningful identity change. The cue, craving, response, and reward loop explains how automatic behavior forms.",
        concepts: [
          {
            concept: "compound habit growth",
            note: "Small repeated actions accumulate into large outcomes."
          },
          {
            concept: "cue-craving-response-reward loop",
            note: "Behavior can be redesigned by changing the loop."
          }
        ]
      },
      {
        id: "deep-work-1",
        title: "Deep Work: Focus Rituals",
        order: 2,
        pages: 5,
        language: "English",
        text:
          "Deep work depends on protecting attention from context switching. A ritual defines where you work, for how long, and what success looks like before distraction can negotiate with you.",
        concepts: [
          {
            concept: "attention residue",
            note: "Switching tasks leaves part of the mind behind."
          },
          {
            concept: "focus ritual",
            note: "A fixed routine reduces the effort required to begin."
          }
        ]
      },
      {
        id: "global-reading-1",
        title: "Global Text: Active Reading",
        order: 3,
        pages: 3,
        language: "Spanish",
        text:
          "La lectura activa convierte cada pagina en una conversacion. El lector pregunta, responde y guarda ideas clave para repasarlas despues.",
        concepts: [
          {
            concept: "active reading",
            note: "Reading improves when the learner questions and recalls."
          },
          {
            concept: "automatic translation",
            note: "Translation expands access to global source material."
          }
        ]
      }
    ]
  }
];

const translations = new Map([
  ["la lectura activa convierte cada pagina en una conversacion", "active reading turns every page into a conversation"],
  ["el lector pregunta responde y guarda ideas clave para repasarlas despues", "the reader asks, answers, and saves key ideas for later review"]
]);

export function buildKnowledgeProfile(library, progress) {
  const chapters = library.flatMap((book) => book.chapters);
  const visibleIds = new Set([...progress.completedChapterIds, progress.currentChapterId]);
  const visibleChapters = chapters.filter((chapter) => visibleIds.has(chapter.id));
  const lockedChapters = chapters.filter((chapter) => !visibleIds.has(chapter.id));

  return {
    chaptersRead: progress.completedChapterIds.length,
    knownConcepts: visibleChapters.flatMap((chapter) =>
      chapter.concepts.map((item) => ({
        ...item,
        source: chapter.title
      }))
    ),
    lockedConcepts: lockedChapters.flatMap((chapter) => chapter.concepts.map((item) => item.concept)),
    summary: visibleChapters
      .map((chapter) => `${chapter.title}: ${chapter.concepts.map((item) => item.concept).join(", ")}`)
      .join(" | ")
  };
}

export function createFocusSession({ requiredPages = 3, dueCards = 6, requiredMinutes = 0 } = {}) {
  return updateProgress({
    requiredPages,
    dueCards,
    requiredMinutes,
    pagesRead: 0,
    completedCards: 0,
    startedAt: Date.now(),
    minutesRemaining: requiredMinutes,
    progressPercent: 0
  });
}

export function updateProgress(session, changes = {}) {
  const next = { ...session, ...changes };
  const pagePercent = next.requiredPages ? Math.min(next.pagesRead / next.requiredPages, 1) : 1;
  const cardPercent = next.dueCards ? Math.min(next.completedCards / next.dueCards, 1) : 0;
  const progressPercent = Math.round(Math.max(pagePercent, cardPercent) * 100);

  return {
    ...next,
    pagesRead: Math.max(0, next.pagesRead),
    completedCards: Math.max(0, next.completedCards),
    progressPercent,
    minutesRemaining: Math.max(0, next.requiredMinutes ?? 0)
  };
}

export function isContentUnlocked(session) {
  return session.pagesRead >= session.requiredPages || (session.dueCards > 0 && session.completedCards >= session.dueCards);
}

export function buildFocusState({
  focusStartedAt,
  now,
  requiredMinutes,
  pagesFlipped,
  requiredPages,
  cardsReviewed,
  requiredCards
}) {
  const elapsedMinutes = Math.floor((now - focusStartedAt) / 60_000);
  const missing = [
    [requiredMinutes - elapsedMinutes, "minute"],
    [requiredPages - pagesFlipped, "page"],
    [requiredCards - cardsReviewed, "card"]
  ]
    .filter(([amount]) => amount > 0)
    .map(([amount, label]) => `${amount} more ${label}(s)`);

  return {
    locked: missing.length > 0,
    missing
  };
}

export function askOfflineTutor({ prompt, chapter, progress, library }) {
  const profile = buildKnowledgeProfile(library, progress);
  const lowerPrompt = prompt.toLowerCase();
  const artifacts = suggestLearningArtifacts(chapter, progress, library);
  const response = {
    text: "",
    translation: translateText(chapter.text),
    suggestedNote: createNote({ text: artifacts.notes[0], chapterId: chapter.id, type: "ai note" }),
    suggestedFlashcard: createFlashcard({ ...artifacts.flashcards[0], chapterId: chapter.id })
  };

  if (lowerPrompt.includes("translate") || chapter.language !== "English") {
    response.text = `Translation preview: ${response.translation}`;
    return response;
  }

  if (lowerPrompt.includes("difficult") || lowerPrompt.includes("valuable")) {
    response.text = `Reflection saved. Connect "${chapter.concepts[0].concept}" to what you already know: ${profile.summary}.`;
    return response;
  }

  if (lowerPrompt.includes("card") || lowerPrompt.includes("flashcard")) {
    response.text = `Suggested card: ${response.suggestedFlashcard.front} -> ${response.suggestedFlashcard.back}`;
    return response;
  }

  response.text = `Remember "${chapter.concepts[0].concept}": ${chapter.concepts[0].note} Recall question: ${generateChapterQuiz(chapter, progress, library)[0]}`;
  return response;
}

export function suggestLearningArtifacts(chapter, progress, library) {
  const profile = buildKnowledgeProfile(library, progress);
  const firstSentence = chapter.text.split(".")[0].trim();

  return {
    notes: [
      `${chapter.title}: ${chapter.concepts.map((item) => item.concept).join(" + ")}.`,
      `Connection prompt: relate ${chapter.concepts[0].concept} to ${profile.knownConcepts[0]?.concept ?? "today's reading"}.`
    ],
    highlights: [firstSentence],
    flashcards: [
      {
        front: `What should you remember from ${chapter.title}?`,
        back: chapter.concepts.map((item) => `${item.concept}: ${item.note}`).join(" "),
        deck: "Tabor MVP",
        tags: [chapter.id, "ai-generated"]
      }
    ]
  };
}

export function createNote({ text, chapterId, type = "note" }) {
  return {
    id: `note-${slugify(chapterId)}-${slugify(text).slice(0, 18)}`,
    type,
    text,
    source: chapterId
  };
}

export function createFlashcard(input, back, chapterId) {
  const card = typeof input === "object"
    ? input
    : { front: input, back, chapterId, deck: `Tabor::${chapterId}`, tags: [] };

  return {
    id: `card-${slugify(card.chapterId ?? card.source ?? card.front).slice(0, 24)}`,
    deck: card.deck ?? "Tabor MVP",
    front: card.front,
    back: card.back,
    source: card.chapterId ?? card.source ?? "imported",
    tags: card.tags ?? [],
    votes: card.votes ?? 0
  };
}

export function chapterDeck(chapterId) {
  return [
    createFlashcard({
      chapterId,
      deck: "Community top cards",
      front: "How does a focus ritual protect learning?",
      back: "It makes the start condition explicit and reduces negotiation with distraction.",
      tags: [chapterId, "community"],
      votes: 42
    }),
    createFlashcard({
      chapterId,
      deck: "Community top cards",
      front: "What is attention residue?",
      back: "The cognitive cost left over after switching contexts.",
      tags: [chapterId, "community"],
      votes: 31
    })
  ];
}

export function generateChapterQuiz(chapter, progress, library) {
  const profile = buildKnowledgeProfile(library, progress);
  const priorConcept = profile.knownConcepts[0]?.concept ?? chapter.concepts[0].concept;

  return [
    `Explain ${chapter.concepts[0].concept} without looking at the page.`,
    `What was valuable, and what was difficult, in ${chapter.title}?`,
    `Connect ${chapter.concepts[0].concept} to ${priorConcept}.`
  ];
}

export function buildAnkiExport(flashcards) {
  return flashcards
    .map((card) => [card.front, card.back, card.deck, card.tags.join(" ")].map(cleanTsv).join("\t"))
    .join("\n");
}

export function translateText(text) {
  let translated = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, "");

  for (const [source, target] of translations.entries()) {
    translated = translated.replace(source, target);
  }

  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

function cleanTsv(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
