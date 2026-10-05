import { create } from 'zustand';

export type ToastTone = 'success' | 'info';

export type ToastMessage = { id: number; message: string; tone: ToastTone };

type ToastState = {
  /** The last message; kept after hiding so the exit animation still has text. */
  current: ToastMessage | null;
  visible: boolean;
  show: (message: string, tone?: ToastTone) => void;
  hide: (id: number) => void;
};

let nextId = 1;

/** The single toast slot rendered by <ToastHost /> in the root layout. */
export const useToastStore = create<ToastState>()((set) => ({
  current: null,
  visible: false,
  show: (message, tone = 'success') => set({ current: { id: nextId++, message, tone }, visible: true }),
  hide: (id) => set((s) => (s.current?.id === id ? { visible: false } : s)),
}));

/** Shows a short confirmation pill at the top of the screen. */
export function toast(message: string, tone: ToastTone = 'success') {
  useToastStore.getState().show(message, tone);
}
