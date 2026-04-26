import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Flame, Layers, Clock, ChevronRight, Star, Brain, Zap } from 'lucide-react';
import { api, UserProfile, Book, Flashcard } from '../store';

export function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    api.get('/profile').then(setProfile);
    api.get('/books').then(d => setBooks(d.slice(0, 4)));
    api.get('/flashcards?due=true').then(d => setDueCards(d.slice(0, 3)));
  }, []);

  const stats = [
    { label: 'Reading Streak', value: `${profile?.streak ?? 0}d`, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Books in Library', value: profile?.totalBooks ?? 0, icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Cards Reviewed', value: profile?.total_cards_reviewed ?? 0, icon: Layers, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Cards Due Today', value: profile?.dueCards ?? 0, icon: Brain, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Good morning</h1>
          <p className="text-slate-400 mt-1">Your daily learning briefing is ready.</p>
        </div>
        <Link to="/focus" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-900/40">
          <Zap size={16} />
          Start Focus Session
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Due Flashcards */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Brain size={18} className="text-indigo-400" /> Due for Review
            </h2>
            <Link to="/flashcards" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Study all <ChevronRight size={14} />
            </Link>
          </div>
          {dueCards.length === 0 ? (
            <div className="text-center py-8">
              <Star size={32} className="text-yellow-400 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">All caught up!</p>
              <p className="text-slate-500 text-sm mt-1">No cards due for review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dueCards.map(card => (
                <div key={card.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-sm text-slate-200 font-medium line-clamp-2">{card.front}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">{card.book_title || 'General'}</span>
                  </div>
                </div>
              ))}
              <Link to="/flashcards?mode=study" className="block w-full text-center py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded-xl text-sm font-medium transition-colors">
                Study {profile?.dueCards} cards
              </Link>
            </div>
          )}
        </div>

        {/* Recent Books */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BookOpen size={18} className="text-blue-400" /> Continue Reading
            </h2>
            <Link to="/library" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Library <ChevronRight size={14} />
            </Link>
          </div>
          {books.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No books yet</p>
              <Link to="/library" className="text-indigo-400 text-sm hover:text-indigo-300 mt-2 inline-block">Upload your first book →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {books.map(book => {
                const progress = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
                return (
                  <Link key={book.id} to={`/reader/${book.id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                    <div className="w-10 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: book.cover_color }}>
                      {book.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{book.title}</p>
                      <p className="text-xs text-slate-500">{book.author || 'Unknown author'}</p>
                      <div className="mt-1.5 bg-white/10 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: book.cover_color }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <Clock size={14} />
                      <span className="text-xs">{progress}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Airlock status */}
      <div className="glass rounded-2xl p-6 border border-indigo-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <Zap size={24} className="text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Airlock Protocol</h3>
            <p className="text-sm text-slate-400 mt-0.5">Complete your daily flashcard review to unlock unrestricted device access.</p>
          </div>
          <Link to="/settings" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">Configure →</Link>
        </div>
      </div>
    </div>
  );
}
