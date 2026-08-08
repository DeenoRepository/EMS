"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/ui";
import EquipmentPassportForm from "@/components/eps/equipment-passport-form";

export default function NewEquipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <Breadcrumbs
          items={[
            { label: "EPS Паспортизация", href: "/modules/eps" },
            { label: "Создание паспорта" },
          ]}
        />

        <PageHeader
          title="Создание Паспорта оборудования"
          description="Ввод первичных данных новой единицы техники и привязка к цеху."
        />

        <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 text-xs rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-semibold"
            >
              {error}
            </div>
          )}

          <EquipmentPassportForm
            onSubmit={async (formData) => {
              setError(null);
              setLoading(true);
              try {
                const res = await fetch("/api/modules/eps/equipment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(formData),
                });

                if (!res.ok) {
                  const errData = await res.json();
                  setError(errData.error || "Не удалось сохранить паспорт оборудования");
                  return;
                }

                router.push("/modules/eps");
                router.refresh();
              } catch {
                setError("Ошибка сети при сохранении");
              } finally {
                setLoading(false);
              }
            }}
            onCancel={() => router.push("/modules/eps")}
            submitting={loading}
            submitLabel="Сохранить технический паспорт"
          />
        </div>
      </main>
    </ShellLayout>
  );
}

