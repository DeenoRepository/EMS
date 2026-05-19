"use client";

import { useEffect } from "react";
import { COMPACT_UI_EVENT, getCompactUi } from "@/lib/client/ui-preferences";

function applyCompactClass(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("compact-ui", enabled);
}

export function UiPreferencesSync() {
  useEffect(() => {
    applyCompactClass(getCompactUi());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      applyCompactClass(Boolean(detail));
    };
    window.addEventListener(COMPACT_UI_EVENT, onChange);
    return () => window.removeEventListener(COMPACT_UI_EVENT, onChange);
  }, []);

  return null;
}

