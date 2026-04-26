import { Link, useLocation } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Layers, Settings, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useAppStore } from '../store';
import { Notification } from './Notification';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/library', icon: BookOpen, label: 'Library' },
  { path: '/flashcards', icon: Layers, label: 'Flashcards' },
  { path: '/focus', icon: Zap, label: 'Focus Mode' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className={`flex flex-col glass border-r border-indigo-900/30 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-indigo-900/30">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} className="text-white" />
          </div>
          {sidebarOpen && <span className="font-bold text-lg tracking-tight text-white">Tabor</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                  ${active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center py-4 border-t border-indigo-900/30 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      <Notification />
    </div>
  );
}
