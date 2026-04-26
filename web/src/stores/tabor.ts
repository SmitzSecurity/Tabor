import { create } from "zustand";

type TaborState = {
  airlockOpen: boolean;
  setAirlockOpen: (v: boolean) => void;
  focusActive: boolean;
  setFocusActive: (v: boolean) => void;
  requiredPages: number;
  setRequiredPages: (n: number) => void;
  focusPagesRead: number;
  setFocusPagesRead: (n: number) => void;
  incFocusPage: () => void;
};

export const useTaborStore = create<TaborState>((set) => ({
  airlockOpen: false,
  setAirlockOpen: (v) => set({ airlockOpen: v }),
  focusActive: false,
  setFocusActive: (v) => set((s) => ({ focusActive: v, focusPagesRead: v ? 0 : s.focusPagesRead })),
  requiredPages: 10,
  setRequiredPages: (n) => set({ requiredPages: n }),
  focusPagesRead: 0,
  setFocusPagesRead: (n) => set({ focusPagesRead: n }),
  incFocusPage: () => set((s) => ({ focusPagesRead: s.focusPagesRead + 1 })),
}));
