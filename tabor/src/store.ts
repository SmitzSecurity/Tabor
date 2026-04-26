import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Book {
  id: string;
  title: string;
  author: string;
  filename: string;
  cover_color: string;
  total_pages: number;
  current_page: number;
  last_read: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  book_id: string;
  page: number;
  text: string;
  color: string;
  note: string;
  created_at: string;
}

export interface Flashcard {
  id: string;
  book_id: string | null;
  book_title: string;
  chapter: number;
  front: string;
  back: string;
  tags: string;
  source: string;
  community_votes: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  created_at: string;
}

export interface UserProfile {
  streak_days: string;
  last_study_date: string;
  total_cards_reviewed: string;
  total_pages_read: string;
  daily_card_goal: string;
  focus_mode_enabled: string;
  airlock_enabled: string;
  airlock_cards_required: string;
  theme: string;
  totalBooks: number;
  totalHighlights: number;
  totalFlashcards: number;
  dueCards: number;
  streak: number;
}

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  currentBookId: string | null;
  setCurrentBookId: (id: string | null) => void;
  focusModeActive: boolean;
  setFocusModeActive: (v: boolean) => void;
  focusGoal: { type: 'timer' | 'pages' | 'cards'; value: number } | null;
  setFocusGoal: (g: AppState['focusGoal']) => void;
  focusProgress: number;
  setFocusProgress: (n: number) => void;
  aiPanelOpen: boolean;
  setAiPanelOpen: (v: boolean) => void;
  selectedText: string;
  setSelectedText: (t: string) => void;
  notification: string | null;
  setNotification: (msg: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      currentBookId: null,
      setCurrentBookId: (id) => set({ currentBookId: id }),
      focusModeActive: false,
      setFocusModeActive: (v) => set({ focusModeActive: v }),
      focusGoal: null,
      setFocusGoal: (g) => set({ focusGoal: g }),
      focusProgress: 0,
      setFocusProgress: (n) => set({ focusProgress: n }),
      aiPanelOpen: false,
      setAiPanelOpen: (v) => set({ aiPanelOpen: v }),
      selectedText: '',
      setSelectedText: (t) => set({ selectedText: t }),
      notification: null,
      setNotification: (msg) => set({ notification: msg }),
    }),
    { name: 'tabor-app-state', partialize: (s) => ({ currentBookId: s.currentBookId }) }
  )
);

const API = 'http://localhost:3001/api';

export const api = {
  get: (path: string) => fetch(`${API}${path}`).then(r => r.json()),
  post: (path: string, body?: unknown) => fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json()),
  patch: (path: string, body: unknown) => fetch(`${API}${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
  delete: (path: string) => fetch(`${API}${path}`, { method: 'DELETE' }).then(r => r.json()),
  upload: (path: string, formData: FormData) => fetch(`${API}${path}`, { method: 'POST', body: formData }).then(r => r.json()),
};
