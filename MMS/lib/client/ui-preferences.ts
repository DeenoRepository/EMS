"use client";

export const COMPACT_UI_KEY = "mms:compact-ui";
export const COMPACT_UI_EVENT = "mms:compact-ui-change";

export function getCompactUi(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COMPACT_UI_KEY) === "1";
}

export function setCompactUi(next: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPACT_UI_KEY, next ? "1" : "0");
  window.dispatchEvent(new CustomEvent(COMPACT_UI_EVENT, { detail: next }));
}

