"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { notifyInfo } from "@/lib/client/notify";

function isEditableElement(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AppHotkeys() {
  const pathname = usePathname();
  const router = useRouter();
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.key === "/" && !isEditableElement(event.target)) {
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>("[data-global-search='true']");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (event.ctrlKey && event.key === "Enter") {
        const form = document.querySelector<HTMLFormElement>("form");
        if (form) {
          event.preventDefault();
          form.requestSubmit();
        }
        return;
      }

      if (!isEditableElement(event.target)) {
        if (lastKeyRef.current === "g" && key === "o") {
          event.preventDefault();
          router.push("/operations");
          lastKeyRef.current = "";
          return;
        }
        if (lastKeyRef.current === "g" && key === "f") {
          event.preventDefault();
          router.push("/failures");
          lastKeyRef.current = "";
          return;
        }

        if (key === "g") {
          lastKeyRef.current = "g";
          window.setTimeout(() => {
            if (lastKeyRef.current === "g") lastKeyRef.current = "";
          }, 900);
          return;
        }

        if (key === "n") {
          event.preventDefault();
          if (pathname?.startsWith("/ppr-plans")) router.push("/ppr-plans");
          else if (pathname?.startsWith("/operations")) router.push("/operations");
          else if (pathname?.startsWith("/failures")) router.push("/failures");
          else if (pathname?.startsWith("/work-orders")) router.push("/work-orders");
          else if (pathname?.startsWith("/schedule")) router.push("/schedule");
          else if (pathname?.startsWith("/analytics")) router.push("/analytics");
          else router.push("/dashboard");
          return;
        }

        if (event.key === "?") {
          event.preventDefault();
          notifyInfo(
            "Горячие клавиши",
            "/: поиск, G O: операции, G F: отказы, N: текущий раздел, Ctrl+Enter: сохранить"
          );
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  return null;
}
