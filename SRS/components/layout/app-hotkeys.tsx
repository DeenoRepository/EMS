"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { notifyInfo } from "@/lib/client/notify";

const ESCAPE_EVENT = "deps:escape";

function isEditableElement(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function resolveCreatePath(pathname: string) {
  if (pathname.startsWith("/failures")) return "/failures";
  if (pathname.startsWith("/reports")) return "/reports";
  return null;
}

export function AppHotkeys() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.dispatchEvent(new CustomEvent(ESCAPE_EVENT));
        return;
      }
      if (isEditableElement(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>("[data-global-search='true']");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }
      if (event.key.toLowerCase() === "n") {
        const createPath = resolveCreatePath(pathname || "");
        if (!createPath) return;
        event.preventDefault();
        router.push(createPath);
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        notifyInfo("Горячие клавиши", "/: поиск, N: новая запись, Esc: закрыть активное окно");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  return null;
}
