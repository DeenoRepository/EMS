"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { notifyInfo } from "@/lib/client/notify";

function isEditableElement(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function resolveCreatePath(pathname: string) {
  if (pathname.startsWith("/wms/warehouses")) return "/wms/warehouses/new";
  if (pathname.startsWith("/wms/items")) return "/wms/items/new";
  if (pathname.startsWith("/wms/movements")) return "/wms/movements";
  if (pathname.startsWith("/wms/reservations")) return "/wms/reservations";
  if (pathname.startsWith("/wms")) return "/wms/items/new";
  return null;
}

export function AppHotkeys() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
        notifyInfo("Горячие клавиши", "/: поиск, N: создать, Ctrl+K: палитра команд, Esc: закрыть окно");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  return null;
}
