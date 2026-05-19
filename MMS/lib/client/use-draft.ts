"use client";

import { useEffect } from "react";

export function useDraftState<T>(key: string, value: T, setValue: (next: T) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      setValue(JSON.parse(raw) as T);
    } catch {
      // ignore corrupted draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

