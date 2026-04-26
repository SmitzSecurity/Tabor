import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layers, Plus, ThumbsUp, Trash2, RotateCcw, Check, X, Brain } from 'lucide-react';
import { api, Flashcard, useAppStore } from '../store';

export function Flashcards() {
  const [searchParams] = useSearchParams();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [studyMode, setStudyMode] = useState(searchParams.get('mode') === 'study');
  const [studyIdx, setStudyIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '' });
  const { setNotification } = useAppStore();

  const load = () => {
    api.get('/flashcards').then(setCards);
    api.get('/flashcards?due=true').then(setDueCards);
  };
  useEffect(() => { load(); }, []);

  const createCard = async () => {
    if (!newCard.front || !newCard.back) return;
    await api.post('/flashcards', { ...newCard, source: 'manual' });
    setNewCard({ front: '', back: '' });
    setShowCreate(false);
    setNotification('Flashcard created!');
    load();
  };

  const reviewCard = async (quality: number) => {
    if (studyIdx >= dueCards.length) return;
    const card = dueCards[studyIdx];
    await api.patch(`/flashcards/${card.id}/review`, { quality });
    api.patch('/profile', { study_activity: true });
    setFlipped(false);
    setTimeout(() => setStudyIdx(i => i + 1), 100);
  };

  const deleteCard = async (id: string) => {
    await api.delete(`/flashcards/${id}`);
    setNotification('Card deleted');
    load();
  };

  const voteCard = async (id: string) => {
    await api.patch(`/flashcards/${id}/vote`, {});
    setNotification('Upvoted!');
    load();
  };

  const currentCard = dueCards[studyIdx];
  const studyDone = studyIdx >= dueCards.length;

  const QUALITY_LABELS = [
    { q: 5, label: 'Easy', color: 'bg-green-600 hover:bg-green-500', desc: '+long' },
    { q: 3, label: 'Good', color: 'bg-blue-600 hover:bg-blue-500', desc: '+mid' },
    { q: 1, label: 'Hard', color: 'bg-orange-600 hover:bg-orange-500', desc: '+soon' },
    { q: 0, label: 'Again', color: 'bg-red-600 hover:bg-red-500', desc: 'now' },
  ];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Flashcards</h1>
          <p className="text-slate-400 mt-1">{cards.length} total · {dueCards.length} due</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setStudyMode(true); setStudyIdx(0); setFlipped(false); }}
            disabled={dueCards.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Brain size={16} /> Study ({dueCards.length})
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} /> New Card
          </button>
        </div>
      </div>

      {/* Study Mode */}
      {studyMode && (
        <div className="fixed inset-0 bg-[#0a0a14]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8">
          <button onClick={() => setStudyMode(false)} className="absolute top-6 right-6 text-slate-500 hover:text-slate-300">
            <X size={20} />
          </button>

          {studyDone ? (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <Check size={36} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
              <p className="text-slate-400">You reviewed {Math.min(studyIdx, dueCards.length)} cards.</p>
              <button onClick={() => setStudyMode(false)} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-medium">
                Done
              </button>
            </div>
          ) : (
            <div className="w-full max-w-lg space-y-6 animate-fade-in">
              <div className="text-center text-sm text-slate-500">
                {studyIdx + 1} / {dueCards.length}
              </div>

              {/* Card */}
              <div
                className="relative cursor-pointer select-none"
                style={{ perspective: '1000px' }}
                onClick={() => setFlipped(f => !f)}
              >
                <div
                  className="relative w-full"
                  style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.5s ease',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    minHeight: '260px'
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 glass rounded-2xl p-8 flex flex-col items-center justify-center text-center"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <p className="text-xs text-slate-500 mb-4">QUESTION</p>
                    <p className="text-xl font-medium text-white leading-relaxed">{currentCard?.front}</p>
                    <p className="text-xs text-slate-600 mt-6">Tap to reveal answer</p>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 glass rounded-2xl p-8 flex flex-col items-center justify-center text-center border-indigo-500/30"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <p className="text-xs text-indigo-400 mb-4">ANSWER</p>
                    <p className="text-lg text-slate-200 leading-relaxed">{currentCard?.back}</p>
                  </div>
                </div>
              </div>

              {/* Rating buttons */}
              {flipped && (
                <div className="grid grid-cols-4 gap-3 animate-fade-in">
                  {QUALITY_LABELS.map(({ q, label, color, desc }) => (
                    <button
                      key={q}
                      onClick={() => reviewCard(q)}
                      className={`${color} text-white py-3 rounded-xl text-sm font-medium transition-colors flex flex-col items-center gap-0.5`}
                    >
                      <span>{label}</span>
                      <span className="text-xs opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {!flipped && (
                <button
                  onClick={() => setFlipped(true)}
                  className="w-full py-3 border border-white/10 hover:bg-white/5 text-slate-400 rounded-xl text-sm transition-colors"
                >
                  Reveal Answer
                </button>
              )}

              <p className="text-center text-xs text-slate-600">
                {currentCard?.book_title && `From: ${currentCard.book_title}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4 animate-fade-in">
            <h3 className="font-semibold text-white text-lg">New Flashcard</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Question (Front)</label>
              <textarea
                value={newCard.front}
                onChange={e => setNewCard(p => ({ ...p, front: e.target.value }))}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="What is..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Answer (Back)</label>
              <textarea
                value={newCard.back}
                onChange={e => setNewCard(p => ({ ...p, back: e.target.value }))}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="The answer is..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-white/10 text-slate-400 rounded-xl text-sm hover:bg-white/5">Cancel</button>
              <button onClick={createCard} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Cards list */}
      {cards.length === 0 ? (
        <div className="text-center py-20">
          <Layers size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No flashcards yet</p>
          <p className="text-slate-600 text-sm mt-1">Create a card or use the AI to generate them from your reading</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.id} className="glass rounded-2xl p-5 flex flex-col gap-3 group hover:border-indigo-500/30 border border-transparent transition-all">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-200 leading-relaxed flex-1">{card.front}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => voteCard(card.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors">
                    <ThumbsUp size={13} />
                  </button>
                  <button onClick={() => deleteCard(card.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs text-slate-400 leading-relaxed">{card.back}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {card.book_title && <span className="text-xs text-slate-600 truncate max-w-32">{card.book_title}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${card.source === 'ai' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-500'}`}>
                    {card.source === 'ai' ? 'AI' : 'Manual'}
                  </span>
                </div>
                {card.community_votes > 0 && (
                  <span className="text-xs text-indigo-400 flex items-center gap-1">
                    <ThumbsUp size={10} /> {card.community_votes}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
