import { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, MicOff, Sparkles, Plus, Brain } from 'lucide-react';
import { api, useAppStore, Flashcard } from '../store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  flashcard?: { front: string; back: string };
}

interface AIPanelProps {
  bookId?: string;
  bookTitle?: string;
  currentPage?: number;
  selectedText?: string;
}

export function AIPanel({ bookId, bookTitle, currentPage, selectedText }: AIPanelProps) {
  const { setAiPanelOpen, setNotification } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Hi! I'm Tabor, your reading assistant. Ask me anything about what you're reading, or I can help generate flashcards, quiz you, or summarize content. ${selectedText ? '\n\nI see you\'ve selected some text — want me to explain it or create a flashcard?' : ''}` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'generate' | 'quiz'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedText && selectedText.length > 10) {
      setInput(`Explain this: "${selectedText.substring(0, 200)}${selectedText.length > 200 ? '...' : ''}"`);
    }
  }, [selectedText]);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not available in this browser.'); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      setInput(e.results[0][0].transcript);
      setIsListening(false);
    };
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const data = await api.post('/ai/chat', {
        message: input,
        context: selectedText,
        book_id: bookId,
        page: currentPage,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        flashcard: data.suggestedFlashcard,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' }]);
    }
    setLoading(false);
  };

  const saveFlashcard = async (fc: { front: string; back: string }) => {
    await api.post('/flashcards', { ...fc, book_id: bookId, book_title: bookTitle, source: 'ai' });
    setNotification('Flashcard saved!');
  };

  const generateCards = async () => {
    if (!selectedText && !bookId) return;
    setLoading(true);
    const data = await api.post('/ai/generate-flashcards', {
      text: selectedText || 'Generate flashcards for this book',
      book_id: bookId,
      book_title: bookTitle,
    });
    setLoading(false);
    setNotification(`${data.flashcards?.length || 0} flashcards generated!`);
  };

  const generateQuiz = async () => {
    setLoading(true);
    const data = await api.post('/ai/quiz', { text: selectedText || 'Generate a quiz for this book' });
    const questions: { question: string }[] = data.questions || [];
    if (questions.length) {
      setMessages(prev => [...prev,
        { role: 'assistant', content: `Here's a quick quiz:\n\n${questions.map((q, i) => `**${i + 1}.** ${q.question}`).join('\n\n')}` }
      ]);
      setActiveTab('chat');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Tabor AI</p>
            <p className="text-xs text-slate-500">Reading assistant</p>
          </div>
        </div>
        <button onClick={() => setAiPanelOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['chat', 'generate', 'quiz'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors
              ${activeTab === tab ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab === 'generate' ? 'Flashcards' : tab === 'quiz' ? 'Quiz Me' : 'Chat'}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/8 text-slate-200 border border-white/5'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.flashcard && (
                    <button
                      onClick={() => saveFlashcard(msg.flashcard!)}
                      className="mt-2 flex items-center gap-1.5 text-xs bg-indigo-700/60 hover:bg-indigo-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> Save flashcard
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/8 border border-white/5 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-indigo-500">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask anything..."
                  rows={2}
                  className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={toggleVoice}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isListening ? 'bg-red-600 animate-pulse' : 'bg-white/5 hover:bg-white/10 text-slate-400'}`}
                >
                  {isListening ? <MicOff size={16} className="text-white" /> : <Mic size={16} />}
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'generate' && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-indigo-400" />
            </div>
            <h3 className="text-white font-semibold text-lg">Generate Flashcards</h3>
            <p className="text-slate-400 text-sm mt-2">
              {selectedText ? 'AI will create cards from your selected text.' : 'Select text in the reader to generate targeted cards, or generate from this page.'}
            </p>
          </div>
          {selectedText && (
            <div className="w-full bg-white/5 rounded-xl p-3 text-sm text-slate-400 italic line-clamp-4 border border-white/5">
              "{selectedText.substring(0, 200)}{selectedText.length > 200 ? '...' : ''}"
            </div>
          )}
          <button
            onClick={generateCards}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={16} />}
            Generate Flashcards
          </button>
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
              <Brain size={28} className="text-pink-400" />
            </div>
            <h3 className="text-white font-semibold text-lg">Quiz Me</h3>
            <p className="text-slate-400 text-sm mt-2">Generate adaptive questions based on what you're reading. Your answers will shape future questions.</p>
          </div>
          <button
            onClick={generateQuiz}
            disabled={loading}
            className="w-full py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Brain size={16} />}
            Generate Quiz Questions
          </button>
        </div>
      )}
    </div>
  );
}
