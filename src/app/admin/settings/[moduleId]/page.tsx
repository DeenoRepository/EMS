"use client";

import { useState, useEffect, useCallback, use } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  TabNav,
  TabNavItem,
  Button,
  Input,
} from "@/components/ui";
import {
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  Database,
  Gauge,
  Box,
  Layers,
  AlertCircle,
} from "lucide-react";
import { MODULES_CONFIG, ModuleManifest } from "@/lib/config/modules";

interface DynamicItem {
  id: string;
  [key: string]: any;
}

const ADMIN_TABS: TabNavItem[] = [
  { id: "general", label: "Общие", href: "/admin/settings", icon: <SlidersHorizontal size={14} /> },
  { id: "rbac", label: "Доступ (RBAC)", href: "/admin/rbac", icon: <ShieldCheck size={14} /> },
  { id: "nsi", label: "НСИ", href: "/admin/settings/eps", icon: <Database size={14} /> },
  { id: "audit", label: "Аудит", href: "/admin/audit", icon: <Gauge size={14} /> },
];

export default function DynamicModuleSettingsPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const resolvedParams = use(params);
  const moduleId = resolvedParams.moduleId;

  const manifest: ModuleManifest | undefined = MODULES_CONFIG[moduleId];

  const [activeTabId, setActiveTabId] = useState<string>("");
  const [items, setItems] = useState<DynamicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = manifest?.nsiCategories || [];

  useEffect(() => {
    if (categories.length > 0 && !activeTabId) {
      setActiveTabId(categories[0].id);
    }
  }, [categories, activeTabId]);

  const currentCategory = categories.find((c) => c.id === activeTabId);

  const fetchCategoryItems = useCallback(async () => {
    if (!currentCategory?.apiEndpoint) return;
    setLoading(true);
    try {
      const res = await fetch(currentCategory.apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.items || data.fields || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [currentCategory]);

  useEffect(() => {
    fetchCategoryItems();
  }, [fetchCategoryItems]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemLabel.trim() || !currentCategory?.apiEndpoint) return;

    setSaving(true);
    try {
      const res = await fetch(currentCategory.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newItemLabel.trim(), name: newItemLabel.trim() }),
      });
      if (res.ok) {
        setNewItemLabel("");
        fetchCategoryItems();
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  if (!manifest) {
    return (
      <ShellLayout>
        <main className="w-full px-5 py-6 md:px-8 space-y-6">
          <PageHeader
            title="Модуль не найден"
            breadcrumbs={[
              { title: "Администрирование", href: "/admin/settings" },
              { title: "Ошибка" },
            ]}
          />
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-6 text-rose-800 dark:text-rose-300 flex items-center gap-3">
            <AlertCircle size={20} />
            <div>
              <h2 className="font-bold text-sm">Модуль &quot;{moduleId}&quot; не зарегистрирован в реестре MODULES_CONFIG</h2>
              <p className="text-xs mt-1">Проверьте правильность манифеста модуля в src/lib/config/modules.ts</p>
            </div>
          </div>
        </main>
      </ShellLayout>
    );
  }

  const categoryTabs: TabNavItem[] = categories.map((cat) => ({
    id: cat.id,
    label: cat.name,
  }));

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title={`НСИ ${manifest.name}`}
          description={manifest.description}
          breadcrumbs={[
            { title: "Администрирование", href: "/admin/settings" },
            { title: `НСИ ${manifest.name}` },
          ]}
        />

        {/* NSI Categories Navigation Tabs */}
        {categoryTabs.length > 0 && (
          <TabNav items={categoryTabs} activeId={activeTabId} onChange={(id) => setActiveTabId(id)} />
        )}

        {/* Content Box */}
        {currentCategory && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#17243a] dark:text-slate-100 flex items-center gap-2">
                  <Layers size={16} className="text-[#3473d4] dark:text-blue-400" /> {currentCategory.name}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{currentCategory.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchCategoryItems}
                className="gap-1 text-[11px]"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Обновить
              </Button>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddItem} className="flex items-center gap-3">
              <Input
                type="text"
                placeholder={`Новое значение для ${currentCategory.name}...`}
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={saving || !newItemLabel.trim()}
                className="gap-1.5"
                size="sm"
              >
                <Plus size={14} /> Добавить
              </Button>
            </form>

            {/* List */}
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Загрузка элементов НСИ...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                Записи не найдены в эндпоинте {currentCategory.apiEndpoint}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                {items.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <div className="flex items-center gap-2">
                      <Box size={14} className="text-slate-400 dark:text-slate-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.label || item.name || item.value || item.id}</span>
                      {item.key && <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">({item.key})</span>}
                    </div>
                    {item.dataType && (
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                        {item.dataType}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </ShellLayout>
  );
}
