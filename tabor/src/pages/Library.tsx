import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { BookOpen, Upload, Trash2, Search, Plus, Clock } from 'lucide-react';
import { api, useAppStore } from '../store';
import type { Book } from '../store';

export function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const { setNotification } = useAppStore();

  const load = () => api.get('/books').then(setBooks);
  useEffect(() => { load(); }, []);

  const onDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      if (!file.name.match(/\.(pdf|epub)$/i)) continue;
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      await api.upload('/books/upload', fd);
      setNotification(`"${file.name}" added to library`);
    }
    setUploading(false);
    load();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true });

  const deleteBook = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Remove this book from your library?')) return;
    await api.delete(`/books/${id}`);
    setNotification('Book removed');
    load();
  };

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Library</h1>
          <p className="text-slate-400 mt-1">{books.length} {books.length === 1 ? 'book' : 'books'}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search books..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>

      {/* Upload zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-indigo-500/50 hover:bg-white/5'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDragActive ? 'bg-indigo-600' : 'bg-white/5'}`}>
            {uploading ? (
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={20} className={isDragActive ? 'text-white' : 'text-slate-400'} />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              {uploading ? 'Uploading...' : isDragActive ? 'Drop to add' : 'Drop PDFs here or click to browse'}
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF files up to 100MB</p>
          </div>
        </div>
      </div>

      {/* Book grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{search ? 'No books match your search' : 'Your library is empty'}</p>
          <p className="text-slate-600 text-sm mt-1">Upload a PDF to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(book => {
            const progress = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
            return (
              <Link key={book.id} to={`/reader/${book.id}`} className="group relative flex flex-col animate-fade-in">
                {/* Cover */}
                <div
                  className="aspect-[3/4] rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${book.cover_color}dd, ${book.cover_color}88)` }}
                >
                  <BookOpen size={32} className="text-white/60 mb-3" />
                  <p className="text-white text-xs font-bold text-center line-clamp-3 leading-tight">{book.title}</p>
                  {book.author && <p className="text-white/60 text-xs mt-1 text-center line-clamp-1">{book.author}</p>}

                  {/* Delete */}
                  <button
                    onClick={(e) => deleteBook(book.id, e)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
                  >
                    <Trash2 size={13} className="text-white" />
                  </button>

                  {/* Progress bar */}
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                      <div className="h-full bg-white/60 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>

                <div className="mt-2.5 px-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{book.title}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Clock size={11} />
                    <span>{progress}% read</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
