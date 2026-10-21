import type { MessageRef } from '../i18n/translate';

/** `success` for a saved change; `failure` for a change a Lockout refused. */
export type ToastVariant = 'success' | 'failure';

export interface ToastContent {
  variant: ToastVariant;
  /** Translated when drawn, so a language change reads in the new language. */
  message: MessageRef;
}

export interface Toast extends ToastContent {
  /** Changes for every toast shown, so a replacement is told apart from the one it replaces. */
  id: number;
}

export const TOAST_DURATION_MS = 2500;

export interface ToastStore {
  get(): Toast | null;
  /** Shows the toast in place of any current one and restarts the clock. */
  show(content: ToastContent): void;
  subscribe(listener: (toast: Toast | null) => void): () => void;
}

/** At most one toast at a time; a new one replaces the old (never stacks). */
export function createToastStore(): ToastStore {
  let current: Toast | null = null;
  let nextId = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(toast: Toast | null) => void>();
  const set = (toast: Toast | null) => {
    current = toast;
    listeners.forEach((listener) => listener(toast));
  };
  return {
    get: () => current,
    show(content) {
      if (timer !== undefined) clearTimeout(timer);
      set({ ...content, id: nextId++ });
      timer = setTimeout(() => set(null), TOAST_DURATION_MS);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
