"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShellLayout from "@/components/layout/shell-layout";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import EquipmentPassportForm from "@/components/eps/equipment-passport-form";


export default function NewEquipmentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [equipmentCode, setEquipmentCode] = useState("");
  const [category, setCategory] = useState("Металлообработка");
  const [type, setType] = useState("Обрабатывающий центр");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [inventoryNumber, setInventoryNumber] = useState("");
  const [department, setDepartment] = useState("Цех №1");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/modules/eps/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          equipmentCode,
          category,
          type,
          model,
          serialNumber,
          inventoryNumber,
          department,
          location,
        }),
      });

      if (!res.ok) {
        setError("Не удалось сохранить паспорт оборудования");
        return;
      }

      router.push("/modules/eps");
      router.refresh();
    } catch {
      setError("Ошибка сети при сохранении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        {/* Breadcrumbs */}
        <div className="mb-6 flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <Link href="/" className="hover:text-slate-600">Главная</Link>
          <ChevronRight size={12} />
          <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
          <ChevronRight size={12} />
          <span className="text-[#3473d4]">Создание паспорта</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/modules/eps"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
                Создание Паспорта оборудования
              </h1>
              <p className="mt-1 text-[12px] text-slate-500">
                Ввод первичных данных новой единицы техники и привязка к цеху.
              </p>
            </div>
          </div>
        </div>

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

