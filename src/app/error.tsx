"use client";

import React, { useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <ShellLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="rounded-full bg-rose-100 p-4 text-rose-600 mb-4">
          <AlertOctagon size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Произошла непредвиденная ошибка</h2>
        <p className="mt-2 text-xs text-slate-500 max-w-md">
          {error?.message || "При обработке вашего запроса произошел сбой. Попробуйте обновить страницу или вернуться на главную."}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8]"
          >
            <RefreshCw size={14} /> Повторить попытку
          </button>
          <a
            href="/"
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Home size={14} /> На главную
          </a>
        </div>
      </div>
    </ShellLayout>
  );
}
