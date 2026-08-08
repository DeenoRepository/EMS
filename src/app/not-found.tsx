"use client";

import React from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <ShellLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="rounded-full bg-blue-100 p-4 text-[#2f74df] mb-4">
          <FileQuestion size={36} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Страница не найдена (404)</h2>
        <p className="mt-2 text-xs text-slate-500 max-w-md">
          Запрашиваемая страница не существует или была перемещена в рамках консолидации WMS.
        </p>

        <a
          href="/"
          className="mt-6 flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8]"
        >
          <Home size={14} /> На главную панель
        </a>
      </div>
    </ShellLayout>
  );
}
