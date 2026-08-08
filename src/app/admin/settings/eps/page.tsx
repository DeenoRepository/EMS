"use client";

import { useState, useEffect, useCallback } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  TabNav,
  TabNavItem,
  Button,
  Badge,
  Modal,
  ModalHeader,
  ModalFooter,
  FormField,
  Input,
  Select,
  Checkbox,
} from "@/components/ui";
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
        fetch("/api/reference/fields"),
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
          fetch("/api/reference/fields"),
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
          required: attrRequired,
        }),
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
          key: refKey || refLabel.toLowerCase().replace(/\s+/g, "_"),
        }),
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
          label: newValueLabel || newValueVal,
        }),
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

  const subTabs: TabNavItem[] = [
    { id: "GENERAL", label: "Общие", icon: <Cpu size={14} /> },
    { id: "ATTRIBUTES", label: "Атрибуты", icon: <Sliders size={14} /> },
    { id: "REFERENCES", label: "Справочники", icon: <BookOpen size={14} /> },
  ];

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="НСИ EPS"
          description="Настройка версионирования, динамических атрибутов и справочников."
          breadcrumbs={[
            { title: "Администрирование", href: "/admin/settings" },
            { title: "НСИ EPS" },
          ]}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loadingRefs}
              className="gap-2"
            >
              <RefreshCw size={14} className={loadingRefs ? "animate-spin" : ""} /> Обновить НСИ
            </Button>
          }
        />

        {/* Inner Subsection TabNav */}
        <TabNav items={subTabs} activeId={activeTab} onChange={(id) => setActiveTab(id as any)} />

        {/* TAB 1: GENERAL PARAMETERS */}
        {activeTab === "GENERAL" && (
          <form onSubmit={handleSaveGeneral} className="space-y-6 animate-in fade-in duration-150">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                  <Cpu className="h-4 w-4 text-[#3473d4] dark:text-blue-400" /> Параметры регистратора
                </h2>
                {savedGeneral && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-xs">
                    ✓ Сохранено
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center justify-between border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/40">
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-slate-200">Автоматическое версионирование</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Инкремент v1 → v2 при обновлении спецификации</span>
                  </div>
                  <Checkbox
                    checked={epsAutoVersioning}
                    onChange={(e) => setEpsAutoVersioning(e.target.checked)}
                  />
                </div>

                <div className="flex items-center justify-between border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/40">
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-slate-200">Обязательное согласование</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Маршрутизация в очередь перед публикацией</span>
                  </div>
                  <Checkbox
                    checked={epsRequireApproval}
                    onChange={(e) => setEpsRequireApproval(e.target.checked)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" /> Сохранить настройки
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: ATTRIBUTES CONSTRUCTOR */}
        {activeTab === "ATTRIBUTES" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                <Sliders className="h-4 w-4 text-[#3473d4] dark:text-blue-400" /> Динамические характеристики оборудования
              </h2>
              <Button size="sm" onClick={() => setShowAttrModal(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Добавить атрибут
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgba(15,23,42,.025)] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Привязка / Категория</th>
                    <th className="px-5 py-3">Название характеристики</th>
                    <th className="px-5 py-3">Ключ поля</th>
                    <th className="px-5 py-3">Тип данных</th>
                    <th className="px-5 py-3">Обязательное</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attributes.map((attr) => (
                    <tr key={attr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{attr.typeValue}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">{attr.label}</td>
                      <td className="px-5 py-3.5 font-mono text-[#3473d4] dark:text-blue-400">{attr.key}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-500 dark:text-slate-400">{attr.dataType}</td>
                      <td className="px-5 py-3.5">
                        {attr.required ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">Да</Badge>
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
              <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                <BookOpen className="h-4 w-4 text-[#3473d4] dark:text-blue-400" /> Формирование справочников
              </h2>
              <Button size="sm" onClick={() => setShowRefModal(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Создать справочник
              </Button>
            </div>

            <div className="space-y-4">
              {references.map((ref) => (
                <div key={ref.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-200">{ref.label}</h3>
                      <Badge variant="outline" className="font-mono text-[10px] text-[#3473d4] dark:text-blue-400">{ref.key}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-[11px]"
                        onClick={() => setSelectedFieldForValue(ref)}
                      >
                        <ListPlus className="h-3.5 w-3.5" /> Добавить элемент
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="p-1 text-rose-500 hover:text-rose-700"
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
                          className="gap-1.5 px-3 py-1 text-xs font-medium flex items-center"
                        >
                          <span>{v.label}</span>
                          <span className="text-[10px] font-mono text-slate-400">({v.value})</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteValue(v.id)}
                            className="ml-1 text-slate-400 hover:text-rose-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">В справочнике пока нет элементов.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Add Attribute */}
        <Modal open={showAttrModal} onClose={() => setShowAttrModal(false)} size="md">
          <ModalHeader
            icon={<Sliders size={16} />}
            title="Создание характеристики"
            subtitle="Настройка динамического поля для категории оборудования"
            onClose={() => setShowAttrModal(false)}
          />
          <form onSubmit={handleAddAttribute} className="space-y-4 p-5">
            <FormField label="Привязка к справочнику / позиции">
              <Select
                value={attrTypeValue}
                onChange={(e) => setAttrTypeValue(e.target.value)}
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
              </Select>
            </FormField>

            <FormField label="Название характеристики">
              <Input
                required
                value={attrLabel}
                onChange={(e) => setAttrLabel(e.target.value)}
                placeholder="Мощность привода (кВт)"
              />
            </FormField>

            <FormField label="Ключ поля (Eng/Snake_case)">
              <Input
                value={attrKey}
                onChange={(e) => setAttrKey(e.target.value)}
                placeholder="drive_power_kw"
                className="font-mono"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Тип данных">
                <Select
                  value={attrDataType}
                  onChange={(e) => setAttrDataType(e.target.value)}
                >
                  <option value="TEXT">TEXT (Текст)</option>
                  <option value="NUMBER">NUMBER (Число)</option>
                  <option value="BOOLEAN">BOOLEAN (Флаг)</option>
                  <option value="DATE">DATE (Дата)</option>
                </Select>
              </FormField>

              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="attrReqCheckAdmin"
                  checked={attrRequired}
                  onChange={(e) => setAttrRequired(e.target.checked)}
                />
                <label htmlFor="attrReqCheckAdmin" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Обязательное поле
                </label>
              </div>
            </div>

            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => setShowAttrModal(false)}>
                Отмена
              </Button>
              <Button type="submit">
                Сохранить атрибут
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Modal Add Reference Field */}
        <Modal open={showRefModal} onClose={() => setShowRefModal(false)} size="md">
          <ModalHeader
            icon={<BookOpen size={16} />}
            title="Создание справочника"
            subtitle="Новый классификатор нормативно-справочной информации"
            onClose={() => setShowRefModal(false)}
          />
          <form onSubmit={handleAddReferenceField} className="space-y-4 p-5">
            <FormField label="Название справочника *">
              <Input
                required
                value={refLabel}
                onChange={(e) => setRefLabel(e.target.value)}
                placeholder="например, Заводы-изготовители"
              />
            </FormField>

            <FormField label="Ключ справочника (Eng/Snake_case)">
              <Input
                value={refKey}
                onChange={(e) => setRefKey(e.target.value)}
                placeholder="manufacturers"
                className="font-mono"
              />
            </FormField>

            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => setShowRefModal(false)}>
                Отмена
              </Button>
              <Button type="submit">
                Создать справочник
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Modal Add Reference Value */}
        {selectedFieldForValue && (
          <Modal open={!!selectedFieldForValue} onClose={() => setSelectedFieldForValue(null)} size="md">
            <ModalHeader
              icon={<ListPlus size={16} />}
              title={`Добавление элемента в "${selectedFieldForValue.label}"`}
              subtitle="Укажите уникальное значение кода и отображаемое наименование"
              onClose={() => setSelectedFieldForValue(null)}
            />
            <form onSubmit={handleAddReferenceValue} className="space-y-4 p-5">
              <FormField label="Значение элемента (Код) *">
                <Input
                  required
                  value={newValueVal}
                  onChange={(e) => setNewValueVal(e.target.value)}
                  placeholder="HAAS_AUTOMATION"
                  className="font-mono"
                />
              </FormField>

              <FormField label="Отображаемое название (Label) *">
                <Input
                  required
                  value={newValueLabel}
                  onChange={(e) => setNewValueLabel(e.target.value)}
                  placeholder="HAAS Automation Inc."
                />
              </FormField>

              <ModalFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedFieldForValue(null)}>
                  Отмена
                </Button>
                <Button type="submit">
                  Добавить в справочник
                </Button>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </main>
    </ShellLayout>
  );
}
