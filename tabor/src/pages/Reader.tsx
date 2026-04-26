import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft, ChevronRight, Brain, ZoomIn, ZoomOut,
  Highlighter, MessageSquare, BookOpen, List, Mic
} from 'lucide-react';
import { api, Book, Highlight, useAppStore } from '../store';
import { AIPanel } from '../components/AIPanel';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const COLORS = ['yellow', 'blue', 'green', 'pink'];
const COLOR_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-400/20 border-yellow-400',
  blue: 'bg-blue-400/20 border-blue-400',
  green: 'bg-green-400/20 border-green-400',
  pink: 'bg-pink-400/20 border-pink-400',
};

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [activeColor, setActiveColor] = useState('yellow');
  const [sidePanel, setSidePanel] = useState<'none' | 'ai' | 'highlights'>('none');
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const { setNotification, aiPanelOpen, setAiPanelOpen } = useAppStore();

  useEffect(() => {
    if (!id) return;
    api.get(`/books/${id}`).then(b => {
      setBook(b);
      setPage(b.current_page || 1);
    });
    api.get(`/books/${id}/highlights`).then(setHighlights);
  }, [id]);

  useEffect(() => {
    if (!id || !book) return;
    const t = setTimeout(() => {
      api.patch(`/books/${id}`, { current_page: page, total_pages: numPages });
    }, 1000);
    return () => clearTimeout(t);
  }, [page, numPages]);

  const onDocLoaded = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if (book?.total_pages !== numPages) {
      api.patch(`/books/${id}`, { total_pages: numPages });
    }
  };

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length < 3) {
      setShowHighlightMenu(false);
      return;
    }
    const text = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectedText(text);
    setMenuPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setShowHighlightMenu(true);
  }, []);

  const addHighlight = async (color: string) => {
    if (!id || !selectedText) return;
    const h = await api.post(`/books/${id}/highlights`, { page, text: selectedText, color });
    setHighlights(prev => [...prev, h]);
    setNotification('Highlight saved');
    setShowHighlightMenu(false);
    window.getSelection()?.removeAllRanges();
  };

  const openAI = () => {
    setSidePanel(sidePanel === 'ai' ? 'none' : 'ai');
  };

  const toggleVoiceQuery = () => {
    if (isListening) {
      recRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setSelectedText(text);
      setSidePanel('ai');
      setIsListening(false);
    };
    r.onend = () => setIsListening(false);
    recRef.current = r;
    r.start();
    setIsListening(true);
  };

  const progress = numPages > 0 ? Math.round((page / numPages) * 100) : 0;

  return (
    <div className="flex h-full bg-[#0a0a14]">
      {/* PDF area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0f0f1a] flex-shrink-0">
          <Link to="/library" className="text-slate-500 hover:text-slate-300 mr-2">
            <ChevronLeft size={20} />
          </Link>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{book?.title || 'Loading...'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 max-w-48 bg-white/10 rounded-full h-1">
                <div className="h-1 rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-slate-500">{progress}%</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
              <ZoomIn size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setSidePanel(p => p === 'highlights' ? 'none' : 'highlights')}
              className={`p-2 rounded-lg transition-colors ${sidePanel === 'highlights' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
              title="Highlights"
            >
              <Highlighter size={16} />
            </button>
            <button
              onClick={toggleVoiceQuery}
              className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-600 text-white animate-pulse' : 'hover:bg-white/5 text-slate-400'}`}
              title="Voice query"
            >
              <Mic size={16} />
            </button>
            <button
              onClick={openAI}
              className={`p-2 rounded-lg transition-colors ${sidePanel === 'ai' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
              title="AI Assistant"
            >
              <Brain size={16} />
            </button>
          </div>
        </div>

        {/* PDF Document */}
        <div className="flex-1 overflow-auto" onMouseUp={handleMouseUp}>
          <div className="min-h-full py-6 flex justify-center">
            <Document
              file={`http://localhost:3001/uploads/${book?.filename}`}
              onLoadSuccess={onDocLoaded}
              loading={
                <div className="flex items-center justify-center h-96">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading document...</p>
                  </div>
                </div>
              }
              error={
                <div className="flex items-center justify-center h-96">
                  <div className="flex flex-col items-center gap-4 text-center px-8">
                    <BookOpen size={48} className="text-slate-700" />
                    <p className="text-slate-400">Could not load PDF. Ensure the file was uploaded correctly.</p>
                  </div>
                </div>
              }
            >
              <Page
                pageNumber={page}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        </div>

        {/* Page controls */}
        <div className="flex items-center justify-center gap-4 py-4 border-t border-white/5 bg-[#0f0f1a] flex-shrink-0">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-30 text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={page}
              onChange={e => setPage(Math.max(1, Math.min(numPages, parseInt(e.target.value) || 1)))}
              className="w-14 text-center bg-white/5 border border-white/10 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-500 text-sm">/ {numPages}</span>
          </div>
          <button
            onClick={() => setPage(p => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-30 text-slate-400 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Side panel */}
      {sidePanel !== 'none' && (
        <div className="w-96 flex-shrink-0 border-l border-white/10 flex flex-col bg-[#0f0f1a] animate-slide-in">
          {sidePanel === 'ai' && (
            <AIPanel
              bookId={id}
              bookTitle={book?.title}
              currentPage={page}
              selectedText={selectedText}
            />
          )}
          {sidePanel === 'highlights' && (
            <HighlightsPanel
              highlights={highlights}
              onDelete={async (hid) => {
                await api.delete(`/highlights/${hid}`);
                setHighlights(prev => prev.filter(h => h.id !== hid));
                setNotification('Highlight removed');
              }}
            />
          )}
        </div>
      )}

      {/* Highlight selection menu */}
      {showHighlightMenu && (
        <div
          className="fixed z-50 flex items-center gap-1 bg-[#1a1a2e] border border-white/10 rounded-xl p-2 shadow-2xl shadow-black/50 -translate-x-1/2 -translate-y-full"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => addHighlight(color)}
              className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${COLOR_CLASSES[color].split(' ')[0].replace('bg-', 'bg-').replace('/20', '')}`}
              style={{ background: color === 'yellow' ? '#fbbf24' : color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : '#ec4899' }}
              title={`Highlight ${color}`}
            />
          ))}
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={() => { setSidePanel('ai'); setShowHighlightMenu(false); }}
            className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors"
            title="Ask AI"
          >
            <Brain size={13} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function HighlightsPanel({ highlights, onDelete }: { highlights: Highlight[]; onDelete: (id: string) => void }) {
  const COLOR_DOT: Record<string, string> = {
    yellow: 'bg-yellow-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    pink: 'bg-pink-400',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <Highlighter size={16} className="text-yellow-400" />
        <h3 className="font-semibold text-white">Highlights</h3>
        <span className="text-xs text-slate-500 ml-auto">{highlights.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {highlights.length === 0 && (
          <div className="text-center py-12">
            <Highlighter size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Select text to highlight it</p>
          </div>
        )}
        {highlights.map(h => (
          <div key={h.id} className="group bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${COLOR_DOT[h.color] || 'bg-yellow-400'}`} />
              <p className="text-sm text-slate-300 flex-1 leading-relaxed">{h.text}</p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-600">Page {h.page}</span>
              <button onClick={() => onDelete(h.id)} className="text-xs text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
