"use client";

import { useState, useEffect, useCallback } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Cpu,
  Sliders,
  BookOpen,
  Plus,
  X,
  RefreshCw,
  ListPlus,
  Trash2,
  Save,
  ChevronRight,
  SlidersHorizontal,
  ShieldCheck,
  Database,
  Gauge,
} from "lucide-react";

interface AttributeSchema {
  id: string;
  typeValue: string;
  key: string;
  label: string;
  dataType: string;
  required: boolean;
}

interface ReferenceValueSchema {
  id: string;
  value: string;
  label: string;
}

interface ReferenceFieldSchema {
  id: string;
  key: string;
  label: string;
  description?: string;
  values: ReferenceValueSchema[];
}

export default function EpsModuleSettingsPage() {
  const [activeTab, setActiveTab] = useState<"GENERAL" | "ATTRIBUTES" | "REFERENCES">("GENERAL");

  // General module state
  const [epsAutoVersioning, setEpsAutoVersioning] = useState(true);
  const [epsRequireApproval, setEpsRequireApproval] = useState(true);
  const [savedGeneral, setSavedGeneral] = useState(false);

  // Attributes state
  const [attributes, setAttributes] = useState<AttributeSchema[]>([]);
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [attrTypeValue, setAttrTypeValue] = useState("Обрабатывающий центр");
  const [attrLabel, setAttrLabel] = useState("");
  const [attrKey, setAttrKey] = useState("");
  const [attrDataType, setAttrDataType] = useState("TEXT");
  const [attrRequired, setAttrRequired] = useState(false);

  // References state
  const [references, setReferences] = useState<ReferenceFieldSchema[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [showRefModal, setShowRefModal] = useState(false);
  const [refLabel, setRefLabel] = useState("");
  const [refKey, setRefKey] = useState("");
  const [selectedFieldForValue, setSelectedFieldForValue] = useState<ReferenceFieldSchema | null>(null);
  const [newValueVal, setNewValueVal] = useState("");
  const [newValueLabel, setNewValueLabel] = useState("");

  const fetchData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [attrRes, refRes] = await Promise.all([
        fetch("/api/equipment-type-attributes"),
        fetch("/api/reference/fields")
      ]);
      if (attrRes.ok) setAttributes(await attrRes.json());
      if (refRes.ok) setReferences(await refRes.json());
    } catch {
      // Fallback
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [attrRes, refRes] = await Promise.all([
          fetch("/api/equipment-type-attributes"),
          fetch("/api/reference/fields")
        ]);
        if (attrRes.ok) {
          const attrData = await attrRes.json();
          if (mounted) setAttributes(attrData);
        }
        if (refRes.ok) {
          const refData = await refRes.json();
          if (mounted) setReferences(refData);
        }
      } catch {
        // Fallback
      } finally {
        if (mounted) setLoadingRefs(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedGeneral(true);
    setTimeout(() => setSavedGeneral(false), 3000);
  };

  const handleAddAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/equipment-type-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeValue: attrTypeValue,
          label: attrLabel,
          key: attrKey || attrLabel.toLowerCase().replace(/\s+/g, "_"),
          dataType: attrDataType,
          required: attrRequired
        })
      });
      if (res.ok) {
        setShowAttrModal(false);
        setAttrLabel("");
        setAttrKey("");
        fetchData();
      }
    } catch {
      alert("Ошибка создания атрибута");
    }
  };

  const handleAddReferenceField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/reference/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: refLabel,
          key: refKey || refLabel.toLowerCase().replace(/\s+/g, "_")
        })
      });
      if (res.ok) {
        setShowRefModal(false);
        setRefLabel("");
        setRefKey("");
        fetchData();
      }
    } catch {
      alert("Ошибка создания справочного поля");
    }
  };

  const handleAddReferenceValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldForValue) return;

    try {
      const res = await fetch("/api/reference/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: selectedFieldForValue.id,
          value: newValueVal,
          label: newValueLabel || newValueVal
        })
      });
      if (res.ok) {
        setSelectedFieldForValue(null);
        setNewValueVal("");
        setNewValueLabel("");
        fetchData();
      }
    } catch {
      alert("Ошибка добавления элемента справочника");
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Удалить этот справочник и все входящие элементы?")) return;
    try {
      const res = await fetch(`/api/reference/fields/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch {
      alert("Ошибка удаления");
    }
  };

  const handleDeleteValue = async (id: string) => {
    try {
      const res = await fetch(`/api/reference/values/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch {
      alert("Ошибка удаления элемента");
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <Link href="/" className="hover:text-slate-600">Главная</Link>
          <ChevronRight size={12} />
          <Link href="/admin/settings" className="hover:text-slate-600">Настройки</Link>
          <ChevronRight size={12} />
          <span className="text-[#3473d4]">НСИ & Справочники EPS</span>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a] flex items-center gap-2">
              Справочники & Настройки EPS Паспортизации
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Управление глобальными параметрами, конструктором атрибутов и справочниками модуля EPS.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={13} className={loadingRefs ? "animate-spin" : ""} /> Обновить данные
          </button>
        </div>

        {/* Tabbar inside module subsection settings */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "GENERAL" ? "default" : "ghost"}
            onClick={() => setActiveTab("GENERAL")}
            className="gap-2 text-xs"
          >
            <Cpu className="h-4 w-4" /> Общие Параметры
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "ATTRIBUTES" ? "default" : "ghost"}
            onClick={() => setActiveTab("ATTRIBUTES")}
            className="gap-2 text-xs"
          >
            <Sliders className="h-4 w-4 text-indigo-400" /> Конструктор Атрибутов
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "REFERENCES" ? "default" : "ghost"}
            onClick={() => setActiveTab("REFERENCES")}
            className="gap-2 text-xs"
          >
            <BookOpen className="h-4 w-4 text-emerald-400" /> Формирование Справочников
          </Button>
        </div>

        {/* TAB 1: GENERAL PARAMETERS */}
        {activeTab === "GENERAL" && (
          <form onSubmit={handleSaveGeneral} className="space-y-6 animate-in fade-in duration-150">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2 text-indigo-500">
                  <Cpu className="h-4 w-4" /> Параметры Регистрации и Паспортизации
                </h2>
                {savedGeneral && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">
                    ✓ Изменения сохранены
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center justify-between border border-border p-3.5 rounded-lg bg-muted/20">
                  <div>
                    <span className="font-semibold block text-foreground">Автоматическое версионирование</span>
                    <span className="text-[11px] text-muted-foreground">Инкремент v1 → v2 при обновлении спецификации</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={epsAutoVersioning}
                    onChange={(e) => setEpsAutoVersioning(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                </div>

                <div className="flex items-center justify-between border border-border p-3.5 rounded-lg bg-muted/20">
                  <div>
                    <span className="font-semibold block text-foreground">Обязательное согласование</span>
                    <span className="text-[11px] text-muted-foreground">Маршрутизация в очередь утверждений перед публикацией</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={epsRequireApproval}
                    onChange={(e) => setEpsRequireApproval(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" className="gap-2 text-xs">
                <Save className="h-4 w-4" /> Сохранить настройки подраздела EPS
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: ATTRIBUTES CONSTRUCTOR */}
        {activeTab === "ATTRIBUTES" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2 text-primary">
                <Sliders className="h-4 w-4" /> Динамические Характеристики Техники
              </h2>
              <Button size="sm" onClick={() => setShowAttrModal(true)} className="gap-2 text-xs">
                <Plus className="h-4 w-4" /> Добавить атрибут
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Привязка / Категория</th>
                    <th className="px-5 py-3">Название характеристики</th>
                    <th className="px-5 py-3">Ключ поля</th>
                    <th className="px-5 py-3">Тип данных</th>
                    <th className="px-5 py-3">Обязательное</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {attributes.map((attr) => (
                    <tr key={attr.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5 font-semibold text-foreground">{attr.typeValue}</td>
                      <td className="px-5 py-3.5 font-medium">{attr.label}</td>
                      <td className="px-5 py-3.5 font-mono text-primary">{attr.key}</td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">{attr.dataType}</td>
                      <td className="px-5 py-3.5">
                        {attr.required ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px]">Да</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Нет</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: REFERENCES MANAGEMENT */}
        {activeTab === "REFERENCES" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2 text-emerald-500">
                <BookOpen className="h-4 w-4" /> Формирование Справочников Модуля
              </h2>
              <Button size="sm" onClick={() => setShowRefModal(true)} className="gap-2 text-xs">
                <Plus className="h-4 w-4" /> Создать справочник
              </Button>
            </div>

            <div className="space-y-4">
              {references.map((ref) => (
                <div key={ref.id} className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{ref.label}</h3>
                      <Badge variant="outline" className="font-mono text-xs text-primary">{ref.key}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => setSelectedFieldForValue(ref)}
                      >
                        <ListPlus className="h-3.5 w-3.5" /> Добавить элемент
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="p-1 text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteField(ref.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {ref.values && ref.values.length > 0 ? (
                      ref.values.map((v) => (
                        <Badge
                          key={v.id}
                          variant="secondary"
                          className="gap-1.5 px-3 py-1 text-xs border border-border font-medium flex items-center"
                        >
                          <span>{v.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">({v.value})</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteValue(v.id)}
                            className="ml-1 text-muted-foreground hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">В справочнике пока нет элементов.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Add Attribute */}
        {showAttrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-sm">Создание характеристического поля</h3>
                <button type="button" onClick={() => setShowAttrModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddAttribute} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-medium">Привязка к справочнику / позиции</label>
                  <select
                    value={attrTypeValue}
                    onChange={(e) => setAttrTypeValue(e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                  >
                    {references.map((r) => (
                      <optgroup key={r.id} label={`Справочник: ${r.label}`}>
                        {r.values && r.values.length > 0 ? (
                          r.values.map((v) => (
                            <option key={v.id} value={`${r.label} → ${v.label}`}>
                              {r.label}: {v.label} ({v.value})
                            </option>
                          ))
                        ) : (
                          <option value={r.label}>{r.label} (все позиции)</option>
                        )}
                      </optgroup>
                    ))}
                    <option value="Обрабатывающий центр">Обрабатывающий центр</option>
                    <option value="Прессовое оборудование">Прессовое оборудование</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium">Название характеристики</label>
                  <input
                    type="text"
                    required
                    value={attrLabel}
                    onChange={(e) => setAttrLabel(e.target.value)}
                    placeholder="Мощность привода (кВт)"
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium">Ключ поля (Eng/Snake_case)</label>
                  <input
                    type="text"
                    value={attrKey}
                    onChange={(e) => setAttrKey(e.target.value)}
                    placeholder="drive_power_kw"
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-medium">Тип данных</label>
                    <select
                      value={attrDataType}
                      onChange={(e) => setAttrDataType(e.target.value)}
                      className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="TEXT">TEXT (Текст)</option>
                      <option value="NUMBER">NUMBER (Число)</option>
                      <option value="BOOLEAN">BOOLEAN (Флаг)</option>
                      <option value="DATE">DATE (Дата)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="attrReqCheckAdmin"
                      checked={attrRequired}
                      onChange={(e) => setAttrRequired(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <label htmlFor="attrReqCheckAdmin" className="font-medium cursor-pointer">Обязательное поле</label>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAttrModal(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" size="sm">
                    Сохранить атрибут
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Add Reference Field */}
        {showRefModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-sm">Создание справочника оборудования</h3>
                <button type="button" onClick={() => setShowRefModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddReferenceField} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-medium">Название справочника</label>
                  <input
                    type="text"
                    required
                    value={refLabel}
                    onChange={(e) => setRefLabel(e.target.value)}
                    placeholder="например, Заводы-изготовители"
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium">Ключ справочника (Eng/Snake_case)</label>
                  <input
                    type="text"
                    value={refKey}
                    onChange={(e) => setRefKey(e.target.value)}
                    placeholder="manufacturers"
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowRefModal(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" size="sm">
                    Создать справочник
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Add Reference Value */}
        {selectedFieldForValue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-sm">
                  Добавление элемента в &quot;{selectedFieldForValue.label}&quot;
                </h3>
                <button type="button" onClick={() => setSelectedFieldForValue(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddReferenceValue} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-medium">Значение элемента (Код)</label>
                  <input
                    type="text"
                    required
                    value={newValueVal}
                    onChange={(e) => setNewValueVal(e.target.value)}
                    placeholder="HAAS_AUTOMATION"
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium">Отображаемое название (Label)</label>
                  <input
                    type="text"
                    required
                    value={newValueLabel}
                    onChange={(e) => setNewValueLabel(e.target.value)}
                    placeholder="HAAS Automation Inc."
                    className="w-full rounded border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedFieldForValue(null)}>
                    Отмена
                  </Button>
                  <Button type="submit" size="sm">
                    Добавить в справочник
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </ShellLayout>
  );
}
