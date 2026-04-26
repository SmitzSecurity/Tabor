import {
  askOfflineTutor,
  buildAnkiExport,
  buildKnowledgeProfile,
  chapterDeck,
  createFlashcard,
  createFocusSession,
  createNote,
  generateChapterQuiz,
  isContentUnlocked,
  readingLibrary,
  suggestLearningArtifacts,
  updateProgress
} from './core.js';

const initialState = {
  book: readingLibrary[0],
  currentChapter: readingLibrary[0].chapters[1],
  currentPage: 1,
  progress: { completedChapterIds: ['atomic-habits-1'], currentChapterId: 'deep-work-1' },
  focusSession: createFocusSession({ requiredPages: 3, dueCards: 0 }),
  notes: [],
  flashcards: [],
  transcript: [
    {
      from: 'assistant',
      text: 'Local tutor ready. Ask for a summary, translation, flashcard, quote, or connection to what you have already read.'
    }
  ],
  selectedDeck: 'Deep Work MVP',
  communityCards: chapterDeck('deep-work-1')
};

const state = {};

function resetState() {
  Object.assign(state, structuredClone(initialState), {
    focusSession: createFocusSession({ requiredPages: 3, dueCards: 0 }),
    communityCards: chapterDeck('deep-work-1')
  });
}

const els = {};

function cacheElements() {
  [
    'bookTitle',
    'chapterTitle',
    'chapterBody',
    'chapterMeta',
    'profileList',
    'spoilerGuard',
    'focusStatus',
    'focusProgress',
    'airlockPanel',
    'unlockStatus',
    'pageCount',
    'ankiCount',
    'aiTranscript',
    'promptInput',
    'artifactList',
    'flashcardList',
    'exportOutput',
    'quizList',
    'communityDeck',
    'translationPanel',
    'timerDisplay'
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function render() {
  renderReader();
  renderFocus();
  renderTutor();
  renderArtifacts();
  renderStudy();
}

function renderReader() {
  els.bookTitle.textContent = state.book.title;
  els.chapterTitle.textContent = state.currentChapter.title;
  els.chapterBody.textContent = state.currentChapter.text;
  els.chapterMeta.textContent = `Chapter ${state.currentChapter.order} • ${state.currentChapter.pages} pages • ${state.currentChapter.language}`;
  els.pageCount.textContent = state.focusSession.pagesRead;
  els.ankiCount.textContent = state.flashcards.length;

  const profile = buildKnowledgeProfile(readingLibrary, state.progress);
  els.profileList.innerHTML = profile.knownConcepts
    .map((item) => `<li><strong>${item.concept}</strong><span>${item.note}</span></li>`)
    .join('');
  els.spoilerGuard.textContent = profile.lockedConcepts.length
    ? `Spoiler guard is hiding ${profile.lockedConcepts.length} future concept${profile.lockedConcepts.length === 1 ? '' : 's'}.`
    : 'No locked concepts remain for this book.';
}

function renderFocus() {
  const unlocked = isContentUnlocked(state.focusSession);
  const pagesLeft = Math.max(0, state.focusSession.requiredPages - state.focusSession.pagesRead);
  const cardsLeft = Math.max(0, state.focusSession.dueCards - state.focusSession.completedCards);
  const unlockOptions = [`Read ${pagesLeft} more page${pagesLeft === 1 ? '' : 's'}`];
  if (state.focusSession.dueCards > 0) {
    unlockOptions.push(`finish ${cardsLeft} more card${cardsLeft === 1 ? '' : 's'}`);
  }
  els.focusStatus.textContent = unlocked ? 'Unlocked' : 'Airlock active';
  els.unlockStatus.textContent = unlocked
    ? 'Device/content access is open. Focus session complete.'
    : `${unlockOptions.join(' or ')} to unlock.`;
  els.focusProgress.style.width = `${state.focusSession.progressPercent}%`;
  els.airlockPanel.dataset.locked = String(!unlocked);
  els.timerDisplay.textContent = `${state.focusSession.minutesRemaining}:00 focus window`;
}

function renderTutor() {
  els.aiTranscript.innerHTML = state.transcript
    .map((message) => `<article class="${message.from}"><b>${message.from === 'user' ? 'You' : 'Tabor AI'}</b><p>${message.text}</p></article>`)
    .join('');
  els.aiTranscript.scrollTop = els.aiTranscript.scrollHeight;

  const translation = askOfflineTutor({
    prompt: 'translate this chapter',
    chapter: state.currentChapter,
    progress: state.progress,
    library: readingLibrary
  });
  els.translationPanel.textContent = translation.translation;
}

function renderArtifacts() {
  els.artifactList.innerHTML = state.notes
    .map((note) => `<li><strong>${note.type}</strong><span>${note.text}</span><small>${note.source}</small></li>`)
    .join('');
  els.flashcardList.innerHTML = state.flashcards
    .map((card) => `<li><strong>${card.front}</strong><span>${card.back}</span><small>${card.deck} • ${card.tags.join(', ')}</small></li>`)
    .join('');
  els.exportOutput.value = buildAnkiExport(state.flashcards);
}

function renderStudy() {
  const quiz = generateChapterQuiz(state.currentChapter, state.progress, readingLibrary);
  els.quizList.innerHTML = quiz.map((question) => `<li>${question}</li>`).join('');
  els.communityDeck.innerHTML = state.communityCards
    .sort((a, b) => b.votes - a.votes)
    .map((card) => `<li><strong>${card.votes} votes</strong><span>${card.front}</span></li>`)
    .join('');
}

function addAssistantMessage(text) {
  state.transcript.push({ from: 'assistant', text });
}

function askTutor(prompt) {
  const sequence = state.flashcards.length + state.notes.length + 1;
  const answer = askOfflineTutor({
    prompt,
    chapter: state.currentChapter,
    progress: state.progress,
    library: readingLibrary,
    sequence
  });
  state.transcript.push({ from: 'user', text: prompt });
  addAssistantMessage(answer.text);

  if (answer.suggestedNote) {
    state.notes.unshift(answer.suggestedNote);
  }

  if (answer.suggestedFlashcard) {
    state.flashcards.unshift(answer.suggestedFlashcard);
  }

  render();
}

function wireEvents() {
  document.getElementById('askButton').addEventListener('click', () => {
    const prompt = els.promptInput.value.trim();
    if (!prompt) return;
    els.promptInput.value = '';
    askTutor(prompt);
  });

  els.promptInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('askButton').click();
    }
  });

  document.getElementById('voiceButton').addEventListener('click', () => {
    askTutor('What was valuable and what was difficult? Make a note and flashcard.');
  });

  document.getElementById('saveSuggestionsButton').addEventListener('click', () => {
    const sequence = state.flashcards.length + state.notes.length + 1;
    const suggestions = suggestLearningArtifacts(state.currentChapter, state.progress, readingLibrary, sequence);
    state.notes.unshift(...suggestions.notes.map((text) => createNote({ text, chapterId: state.currentChapter.id })));
    state.flashcards.unshift(...suggestions.flashcards.map((card) => createFlashcard({
      ...card,
      deck: state.selectedDeck,
      chapterId: state.currentChapter.id
    })));
    addAssistantMessage('Saved suggested highlight, chapter note, and Anki-ready flashcard.');
    render();
  });

  document.getElementById('readPageButton').addEventListener('click', () => {
    state.focusSession = updateProgress(state.focusSession, { pagesRead: state.focusSession.pagesRead + 1 });
    state.currentPage += 1;
    render();
  });

  document.getElementById('reviewCardsButton').addEventListener('click', () => {
    state.focusSession = updateProgress(state.focusSession, { completedCards: state.focusSession.completedCards + 1 });
    render();
  });

  document.getElementById('resetDemoButton').addEventListener('click', () => {
    resetState();
    render();
  });

  document.getElementById('finishChapterButton').addEventListener('click', () => {
    const nextChapter = state.book.chapters[2];
    state.progress = {
      completedChapterIds: [...new Set([...state.progress.completedChapterIds, state.currentChapter.id])],
      currentChapterId: nextChapter.id
    };
    state.currentChapter = nextChapter;
    addAssistantMessage('Chapter finished. I updated your profile and generated recall questions for the next chapter.');
    render();
  });

  document.getElementById('copyExportButton').addEventListener('click', async () => {
    els.exportOutput.select();
    await navigator.clipboard?.writeText(els.exportOutput.value);
    addAssistantMessage('Anki TSV export copied. Import it into Anki or sync it through AnkiConnect.');
    render();
  });
}

resetState();
cacheElements();
wireEvents();
render();
