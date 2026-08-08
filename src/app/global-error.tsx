"use client";

import React, { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

export default function GlobalBoundaryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Boundary Error Caught:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="bg-slate-50 font-sans antialiased text-slate-800">
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
          <div className="rounded-full bg-rose-100 p-4 text-rose-600 mb-4">
            <AlertOctagon size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Системная ошибка приложения</h2>
          <p className="mt-2 text-xs text-slate-500 max-w-md">
            {error?.message || "Критический сбой корневого контекста приложения."}
          </p>
          <button
            onClick={() => reset()}
            className="mt-6 flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8]"
          >
            <RefreshCw size={14} /> Перезагрузить систему
          </button>
        </div>
      </body>
    </html>
  );
}
