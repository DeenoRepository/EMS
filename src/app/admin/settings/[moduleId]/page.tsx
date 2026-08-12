"use client";

import { useState, useEffect, useCallback, use } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  Button,
  Input,
  FormField,
  Badge,
  Modal,
  Select,
  Checkbox,
  SearchInput,
} from "@/components/ui";
import {
  Sliders,
  ShieldCheck,
  Database,
  Gauge,
  Plus,
  Trash2,
  Edit2,
  Save,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  FileText,
  Boxes,
} from "lucide-react";
import { MODULES_CONFIG, ModuleManifest } from "@/lib/config/modules";

interface AttributeSchema {
  id: string;
  typeValue: string;
  key: string;
  label: string;
  dataType: string;
  required: boolean;
  unit?: string;
}

interface ReferenceValueSchema {
  id: string;
  value: string;
  label: string;
  isActive?: boolean;
  sortOrder?: number;
}

interface ReferenceFieldSchema {
  id: string;
  key: string;
  label: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  values: ReferenceValueSchema[];
}

export default function ModuleSettingsPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const resolvedParams = use(params);
  const moduleId = resolvedParams.moduleId;
  const manifest: ModuleManifest | undefined = MODULES_CONFIG[moduleId];

  const isWms = moduleId === "wms";
  const isEps = moduleId === "eps";

  // Active Tab: general | attributes | references | rules
  const [activeTab, setActiveTab] = useState<"general" | "attributes" | "references" | "rules">("general");

  // Toast message
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // General settings state
  const [generalState, setGeneralState] = useState({
    autoVersioning: true,
    requireApproval: true,
    strictCellStorage: true,
    allowNegativeStock: false,
    defaultItemsPerPage: 20,
    exportFormat: "XLSX",
    notifyOnChanges: true,
  });

  // Attributes state (EPS specific)
  const [attributes, setAttributes] = useState<AttributeSchema[]>([]);
  const [attrSearch, setAttrSearch] = useState("");
  const [attrTypeFilter, setAttrTypeFilter] = useState("ALL");
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [editingAttr, setEditingAttr] = useState<AttributeSchema | null>(null);
  const [attrForm, setAttrForm] = useState({
    typeValue: "Обрабатывающий центр",
    key: "",
    label: "",
    dataType: "TEXT",
    required: false,
    unit: "",
  });

  // Reference Fields (НСИ) state
  const [referenceFields, setReferenceFields] = useState<ReferenceFieldSchema[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [refSearchCategory, setRefSearchCategory] = useState("");
  const [refSearchValue, setRefSearchValue] = useState("");

  // Modals for Reference Category & Value
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldForm, setFieldForm] = useState({ key: "", label: "", description: "" });

  const [showValueModal, setShowValueModal] = useState(false);
  const [valueForm, setValueForm] = useState({ value: "", label: "" });

  // Fetch Module Specific Data
  const fetchModuleData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      if (isEps) {
        const [attrRes, refRes] = await Promise.all([
          fetch("/api/equipment-type-attributes"),
          fetch("/api/reference/fields"),
        ]);

        if (attrRes.ok) {
          const attrData = await attrRes.json();
          setAttributes(Array.isArray(attrData) ? attrData : []);
        }
        if (refRes.ok) {
          const refData = await refRes.json();
          setReferenceFields(Array.isArray(refData) ? refData : []);
          if (Array.isArray(refData) && refData.length > 0 && !selectedFieldId) {
            setSelectedFieldId(refData[0].id);
          }
        }
      } else if (isWms) {
        const wmsDefaults: ReferenceFieldSchema[] = [
          {
            id: "wms-rf-1",
            key: "wms_categories",
            label: "Категории ТМЦ и СИЗ",
            description: "Классификатор материально-производственных запасов",
            values: [
              { id: "wms-rv-1", value: "ZIP", label: "Запасные части и комплектующие (ЗИП)" },
              { id: "wms-rv-2", value: "PPE", label: "Средства индивидуальной защиты (СИЗ)" },
              { id: "wms-rv-3", value: "CONSUMABLES", label: "Расходные и смазочные материалы" },
              { id: "wms-rv-4", value: "TOOLS", label: "Измерительный и слесарный инструмент" },
            ],
          },
          {
            id: "wms-rf-2",
            key: "wms_warehouses",
            label: "Склады и Зоны хранения",
            description: "Организационная структура складских площадок",
            values: [
              { id: "wms-rv-5", value: "WH_MAIN", label: "Склад №1 (Главный хаб ЗИП)" },
              { id: "wms-rv-6", value: "WH_PPE", label: "Склад №2 (Расходные материалы & СИЗ)" },
              { id: "wms-rv-7", value: "WH_TOOL", label: "Склад №3 (Инструментальный участок)" },
            ],
          },
          {
            id: "wms-rf-3",
            key: "wms_units",
            label: "Единицы измерения ТМЦ",
            description: "Общероссийский классификатор единиц измерения (ОКЕИ)",
            values: [
              { id: "wms-rv-8", value: "PCS", label: "шт (Штука)" },
              { id: "wms-rv-9", value: "SET", label: "компл (Комплект)" },
              { id: "wms-rv-10", value: "KG", label: "кг (Килограмм)" },
              { id: "wms-rv-11", value: "LIT", label: "л (Литр)" },
              { id: "wms-rv-12", value: "METERS", label: "м (Метр)" },
            ],
          },
          {
            id: "wms-rf-4",
            key: "wms_writeoff_reasons",
            label: "Причины списания ТМЦ",
            description: "Классификатор актов списания и вывода из эксплуатации",
            values: [
              { id: "wms-rv-13", value: "WEAR_TEAR", label: "Естественный износ / Эксплуатация" },
              { id: "wms-rv-14", value: "DEFECT", label: "Производственный брак / Дефект" },
              { id: "wms-rv-15", value: "EXPIRED", label: "Истечение срока годности" },
              { id: "wms-rv-16", value: "LOSS", label: "Инвентаризационный убыток" },
            ],
          },
        ];
        setReferenceFields(wmsDefaults);
        if (!selectedFieldId) {
          setSelectedFieldId(wmsDefaults[0].id);
        }
      } else {
        const genericDefaults: ReferenceFieldSchema[] = [
          {
            id: "gen-rf-1",
            key: "generic_statuses",
            label: "Статусы объектов",
            description: "Общие статусы жизненного цикла объектов модуля",
            values: [
              { id: "gen-rv-1", value: "DRAFT", label: "Черновик" },
              { id: "gen-rv-2", value: "ACTIVE", label: "Активен" },
              { id: "gen-rv-3", value: "ARCHIVED", label: "В архиве" },
            ],
          },
        ];
        setReferenceFields(genericDefaults);
        if (!selectedFieldId) {
          setSelectedFieldId(genericDefaults[0].id);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingRefs(false);
    }
  }, [isEps, isWms, selectedFieldId]);

  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  // Selected Reference Category
  const activeCategory = referenceFields.find((f) => f.id === selectedFieldId) || referenceFields[0];

  // Attribute Handlers
  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrForm.label || !attrForm.key) {
      showToast("Заполните обязательные поля ключа и наименования", "error");
      return;
    }

    if (editingAttr) {
      setAttributes((prev) =>
        prev.map((a) => (a.id === editingAttr.id ? { ...a, ...attrForm } : a))
      );
      showToast("Атрибут успешно обновлен");
    } else {
      const newAttr: AttributeSchema = {
        id: `attr-${Date.now()}`,
        ...attrForm,
      };
      setAttributes((prev) => [...prev, newAttr]);
      showToast("Атрибут успешно добавлен");
    }

    setShowAttrModal(false);
    setEditingAttr(null);
    setAttrForm({ typeValue: "Обрабатывающий центр", key: "", label: "", dataType: "TEXT", required: false, unit: "" });
  };

  const handleDeleteAttribute = (id: string) => {
    setAttributes((prev) => prev.filter((a) => a.id !== id));
    showToast("Атрибут удален");
  };

  // Reference Category Handlers
  const handleSaveFieldCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.label || !fieldForm.key) {
      showToast("Заполните наименование и код справочника", "error");
      return;
    }

    const localField: ReferenceFieldSchema = {
      id: `rf-${Date.now()}`,
      key: fieldForm.key,
      label: fieldForm.label,
      description: fieldForm.description,
      values: [],
    };
    setReferenceFields((prev) => [...prev, localField]);
    setSelectedFieldId(localField.id);
    showToast("Новый справочник создан");

    setShowFieldModal(false);
    setFieldForm({ key: "", label: "", description: "" });
  };

  const handleDeleteFieldCategory = (id: string) => {
    setReferenceFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) {
      const remaining = referenceFields.filter((f) => f.id !== id);
      setSelectedFieldId(remaining[0]?.id || null);
    }
    showToast("Справочник удален");
  };

  // Reference Value Handlers
  const handleSaveReferenceValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory || !valueForm.label || !valueForm.value) {
      showToast("Заполните значение и код элемента", "error");
      return;
    }

    const newVal: ReferenceValueSchema = {
      id: `rv-${Date.now()}`,
      value: valueForm.value,
      label: valueForm.label,
    };
    setReferenceFields((prev) =>
      prev.map((f) =>
        f.id === activeCategory.id ? { ...f, values: [...f.values, newVal] } : f
      )
    );
    showToast("Элемент справочника сохранен");

    setShowValueModal(false);
    setValueForm({ value: "", label: "" });
  };

  const handleDeleteValue = (valId: string) => {
    if (!activeCategory) return;
    setReferenceFields((prev) =>
      prev.map((f) =>
        f.id === activeCategory.id
          ? { ...f, values: f.values.filter((v) => v.id !== valId) }
          : f
      )
    );
    showToast("Элемент удален из справочника");
  };

  // Filtered Lists
  const filteredAttributes = attributes.filter((a) => {
    const matchesSearch =
      a.label.toLowerCase().includes(attrSearch.toLowerCase()) ||
      a.key.toLowerCase().includes(attrSearch.toLowerCase());
    const matchesType = attrTypeFilter === "ALL" || a.typeValue === attrTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredCategories = referenceFields.filter(
    (c) =>
      c.label.toLowerCase().includes(refSearchCategory.toLowerCase()) ||
      c.key.toLowerCase().includes(refSearchCategory.toLowerCase())
  );

  const filteredValues = (activeCategory?.values || []).filter(
    (v) =>
      v.label.toLowerCase().includes(refSearchValue.toLowerCase()) ||
      v.value.toLowerCase().includes(refSearchValue.toLowerCase())
  );

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Page Header */}
        <PageHeader
          title={`Настройки модуля: ${manifest?.name || moduleId.toUpperCase()}`}
          description={manifest?.description || "Конфигурация параметров модуля, справочников и бизнес-правил."}
          breadcrumbs={[
            { title: "Администрирование", href: "/admin/settings" },
            { title: `Настройки ${manifest?.name || moduleId.toUpperCase()}` },
          ]}
          actions={
            toast ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-xs border transition-all animate-in fade-in duration-200 ${
                  toast.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                }`}
              >
                <CheckCircle2 size={14} /> {toast.text}
              </span>
            ) : undefined
          }
        />

        {/* Tab Navigation (Exact style matching admin/settings/page.tsx) */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "general"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Sliders size={15} /> Общие параметры
          </button>

          {isEps && (
            <button
              type="button"
              onClick={() => setActiveTab("attributes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "attributes"
                  ? "bg-[#3473d4] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <SlidersHorizontal size={15} /> Конструктор характеристик
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("references")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "references"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Database size={15} /> {isWms ? "Справочники и Номенклатура" : "Конструктор Справочников (НСИ)"}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "rules"
                ? "bg-[#3473d4] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Gauge size={15} /> Правила и Интеграция
          </button>
        </div>

        {/* TAB 1: General Settings */}
        {activeTab === "general" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                  <Sliders size={16} className="text-[#3473d4] dark:text-blue-400" />
                  {isWms ? "Параметры складского учета WMS" : isEps ? "Параметры паспортизации EPS" : "Общие параметры модуля"}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Управление правилами обработки данных, версионированием и форматами отчетов.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#3473d4] dark:text-blue-300 font-semibold">
                {manifest?.version || "v2.3.7"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                {isWms ? (
                  <>
                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                      <Checkbox
                        id="strictCellStorage"
                        checked={generalState.strictCellStorage}
                        onChange={(e) => setGeneralState((p) => ({ ...p, strictCellStorage: e.target.checked }))}
                      />
                      <div>
                        <label htmlFor="strictCellStorage" className="text-xs font-bold text-[#17243a] dark:text-slate-100 cursor-pointer">
                          Строгий ячеистый учет адресов хранения
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Требовать привязку каждого ТМЦ к конкретному стеллажу и ячейке при оприходовании
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                      <Checkbox
                        id="allowNegativeStock"
                        checked={generalState.allowNegativeStock}
                        onChange={(e) => setGeneralState((p) => ({ ...p, allowNegativeStock: e.target.checked }))}
                      />
                      <div>
                        <label htmlFor="allowNegativeStock" className="text-xs font-bold text-[#17243a] dark:text-slate-100 cursor-pointer">
                          Запрет отрицательных остатков ТМЦ (Строгий контроль)
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Блокировать списание и трансфер ТМЦ сверх свободно доступного остатка
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                      <Checkbox
                        id="autoVersioning"
                        checked={generalState.autoVersioning}
                        onChange={(e) => setGeneralState((p) => ({ ...p, autoVersioning: e.target.checked }))}
                      />
                      <div>
                        <label htmlFor="autoVersioning" className="text-xs font-bold text-[#17243a] dark:text-slate-100 cursor-pointer">
                          Автоматическое версионирование объектов
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Создавать новые версии паспортов оборудования и карточек при любых изменениях
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                      <Checkbox
                        id="requireApproval"
                        checked={generalState.requireApproval}
                        onChange={(e) => setGeneralState((p) => ({ ...p, requireApproval: e.target.checked }))}
                      />
                      <div>
                        <label htmlFor="requireApproval" className="text-xs font-bold text-[#17243a] dark:text-slate-100 cursor-pointer">
                          Обязательное согласование изменений
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Направлять карточки объектов в Очередь согласований перед выпуском в рабочий статус
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <FormField label="Количество записей на страницу по умолчанию">
                  <Select
                    value={String(generalState.defaultItemsPerPage)}
                    onChange={(e) => setGeneralState((p) => ({ ...p, defaultItemsPerPage: Number(e.target.value) }))}
                  >
                    <option value="10">10 записей</option>
                    <option value="20">20 записей</option>
                    <option value="50">50 записей</option>
                    <option value="100">100 записей</option>
                  </Select>
                </FormField>

                <FormField label="Формат выгрузки ведомостей и отчетов">
                  <Select
                    value={generalState.exportFormat}
                    onChange={(e) => setGeneralState((p) => ({ ...p, exportFormat: e.target.value }))}
                  >
                    <option value="XLSX">Excel (.xlsx)</option>
                    <option value="PDF">Adobe PDF (.pdf)</option>
                    <option value="CSV">CSV UTF-8 (.csv)</option>
                  </Select>
                </FormField>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic Attributes Builder (EPS) */}
        {activeTab === "attributes" && isEps && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <SearchInput
                  placeholder="Поиск атрибута по имени или ключу..."
                  value={attrSearch}
                  onChange={(val) => setAttrSearch(val)}
                  className="w-full md:w-80"
                />
                <Select
                  value={attrTypeFilter}
                  onChange={(e) => setAttrTypeFilter(e.target.value)}
                  className="w-48 text-xs"
                >
                  <option value="ALL">Все типы оборудования</option>
                  <option value="Обрабатывающий центр">Обрабатывающий центр</option>
                  <option value="Трансформатор">Трансформатор</option>
                  <option value="Электродвигатель">Электродвигатель</option>
                </Select>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setEditingAttr(null);
                  setAttrForm({ typeValue: "Обрабатывающий центр", key: "", label: "", dataType: "TEXT", required: false, unit: "" });
                  setShowAttrModal(true);
                }}
              >
                <Plus size={14} className="mr-1.5" />
                Добавить атрибут
              </Button>
            </div>

            {/* Attribute Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgba(15,23,42,.025)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Тип оборудования</th>
                      <th className="px-4 py-3">Наименование характеристики</th>
                      <th className="px-4 py-3">Системный ключ</th>
                      <th className="px-4 py-3">Тип данных</th>
                      <th className="px-4 py-3">Ед. изм.</th>
                      <th className="px-4 py-3 text-center">Обязательное</th>
                      <th className="px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {filteredAttributes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Характеристики не найдены
                        </td>
                      </tr>
                    ) : (
                      filteredAttributes.map((attr) => (
                        <tr key={attr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {attr.typeValue}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#17243a] dark:text-slate-100">{attr.label}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{attr.key}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300">
                              {attr.dataType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{attr.unit || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            {attr.required ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Да
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Нет</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingAttr(attr);
                                setAttrForm({
                                  typeValue: attr.typeValue,
                                  key: attr.key,
                                  label: attr.label,
                                  dataType: attr.dataType,
                                  required: attr.required,
                                  unit: attr.unit || "",
                                });
                                setShowAttrModal(true);
                              }}
                            >
                              <Edit2 size={13} className="mr-1" />
                              Ред.
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleDeleteAttribute(attr.id)}
                            >
                              <Trash2 size={13} className="mr-1" />
                              Удалить
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Extended Reference Builder (НСИ & Справочники) */}
        {activeTab === "references" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Reference Categories */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-[#17243a] dark:text-slate-100 text-xs flex items-center gap-2">
                  <Database size={15} className="text-[#3473d4] dark:text-blue-400" />
                  Справочники {manifest?.name || moduleId.toUpperCase()}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFieldForm({ key: "", label: "", description: "" });
                    setShowFieldModal(true);
                  }}
                  className="h-8 text-xs"
                >
                  <Plus size={13} className="mr-1" />
                  Создать
                </Button>
              </div>

              <SearchInput
                placeholder="Поиск справочника..."
                value={refSearchCategory}
                onChange={(val) => setRefSearchCategory(val)}
                className="w-full text-xs"
              />

              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Справочники не найдены</p>
                ) : (
                  filteredCategories.map((cat) => {
                    const isSelected = cat.id === selectedFieldId;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedFieldId(cat.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 shadow-xs"
                            : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[#17243a] dark:text-slate-100">{cat.label}</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {cat.values?.length || 0} элем.
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {cat.description || `Код: ${cat.key}`}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Values Constructor */}
            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-4">
              {activeCategory ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-[#17243a] dark:text-slate-100">{activeCategory.label}</h3>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {activeCategory.key}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {activeCategory.description || "Управление справочными значениями и классификаторами"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                        onClick={() => handleDeleteFieldCategory(activeCategory.id)}
                      >
                        <Trash2 size={13} className="mr-1" />
                        Удалить справочник
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setValueForm({ value: "", label: "" });
                          setShowValueModal(true);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Добавить элемент
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <SearchInput
                      placeholder="Поиск по значениям и кодам..."
                      value={refSearchValue}
                      onChange={(val) => setRefSearchValue(val)}
                      className="w-full sm:w-72 text-xs"
                    />
                    <span className="text-xs text-slate-500">
                      Всего элементов: <strong className="text-slate-800 dark:text-slate-200">{activeCategory.values?.length || 0}</strong>
                    </span>
                  </div>

                  {/* Values List Grid / Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-3.5 py-2.5">Код / Системное значение</th>
                          <th className="px-3.5 py-2.5">Отображаемое наименование</th>
                          <th className="px-3.5 py-2.5 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {filteredValues.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                              В данном справочнике пока нет элементов
                            </td>
                          </tr>
                        ) : (
                          filteredValues.map((val) => (
                            <tr key={val.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400">{val.value}</td>
                              <td className="px-3.5 py-2.5 font-semibold text-[#17243a] dark:text-slate-100">{val.label}</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => handleDeleteValue(val.id)}
                                >
                                  <Trash2 size={12} className="mr-1" />
                                  Удалить
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Выберите или создайте справочник из списка слева
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Rules & Integrations */}
        {activeTab === "rules" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)] space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-[#17243a] dark:text-slate-100">
                <Gauge size={16} className="text-[#3473d4] dark:text-blue-400" />
                Правила обработки и интеграции
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Настройки триггеров аудита, порогов согласования и интеграционных правил.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <h4 className="text-xs font-bold text-[#17243a] dark:text-slate-100 flex items-center gap-2">
                  <Gauge size={15} className="text-[#3473d4]" />
                  Пороги автоматического утверждения
                </h4>
                <p className="text-[11px] text-slate-500">
                  Изменения ниже определенного уровня утверждаются автоматически.
                </p>
                <FormField label="Порог уровня важности (1-5)">
                  <Input type="number" defaultValue="3" min="1" max="5" />
                </FormField>
              </div>

              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <h4 className="text-xs font-bold text-[#17243a] dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  Аудит и Безопасность
                </h4>
                <p className="text-[11px] text-slate-500">
                  Фиксация всех CRUD операций над объектами модуля в глобальном аудит-логе EMS.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox id="auditEnabled" defaultChecked label="Вести подробный журнал всех изменений" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons Footer (Matching admin/settings/page.tsx footer) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={fetchModuleData}
            className="gap-2 text-xs"
          >
            <RotateCcw size={14} className={loadingRefs ? "animate-spin" : ""} /> Сбросить к умолчаниям
          </Button>

          <Button
            type="button"
            onClick={() => showToast(`Настройки модуля ${manifest?.name || moduleId} успешно сохранены`)}
            className="gap-2 px-6 shadow-md"
          >
            <Save size={15} /> Сохранить конфигурацию модуля
          </Button>
        </div>

        {/* MODAL: Attribute Constructor */}
        <Modal open={showAttrModal} onClose={() => setShowAttrModal(false)}>
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#17243a] dark:text-slate-100">
              {editingAttr ? "Редактирование характеристики" : "Новая динамическая характеристика"}
            </h2>
            <p className="text-[11px] text-slate-500">Задайте параметр и системный ключ для типа оборудования</p>
          </div>

          <form onSubmit={handleSaveAttribute} className="space-y-4 mt-3">
            <FormField label="Тип оборудования" required>
              <Select
                value={attrForm.typeValue}
                onChange={(e) => setAttrForm((p) => ({ ...p, typeValue: e.target.value }))}
              >
                <option value="Обрабатывающий центр">Обрабатывающий центр</option>
                <option value="Трансформатор">Трансформатор</option>
                <option value="Электродвигатель">Электродвигатель</option>
                <option value="Насосный агрегат">Насосный агрегат</option>
              </Select>
            </FormField>

            <FormField label="Наименование характеристики" required>
              <Input
                placeholder="например, Максимальная частота вращения"
                value={attrForm.label}
                onChange={(e) => setAttrForm((p) => ({ ...p, label: e.target.value }))}
              />
            </FormField>

            <FormField label="Системный ключ (латиница)" required>
              <Input
                placeholder="например, max_rpm_speed"
                value={attrForm.key}
                onChange={(e) => setAttrForm((p) => ({ ...p, key: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Тип данных">
                <Select
                  value={attrForm.dataType}
                  onChange={(e) => setAttrForm((p) => ({ ...p, dataType: e.target.value }))}
                >
                  <option value="TEXT">Текст (TEXT)</option>
                  <option value="NUMBER">Число (NUMBER)</option>
                  <option value="SELECT">Справочник (SELECT)</option>
                  <option value="BOOLEAN">Флаг Да/Нет (BOOLEAN)</option>
                </Select>
              </FormField>

              <FormField label="Единица измерения">
                <Input
                  placeholder="об/мин, кВт, кг"
                  value={attrForm.unit}
                  onChange={(e) => setAttrForm((p) => ({ ...p, unit: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="attrRequired"
                checked={attrForm.required}
                onChange={(e) => setAttrForm((p) => ({ ...p, required: e.target.checked }))}
                label="Обязательное поле при создании оборудования"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setShowAttrModal(false)}>
                Отмена
              </Button>
              <Button type="submit">
                Сохранить
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: Reference Field Category */}
        <Modal open={showFieldModal} onClose={() => setShowFieldModal(false)}>
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#17243a] dark:text-slate-100">
              Создание справочника для {manifest?.name || moduleId}
            </h2>
            <p className="text-[11px] text-slate-500">Добавьте новую категорию справочника в реестр модуля</p>
          </div>

          <form onSubmit={handleSaveFieldCategory} className="space-y-4 mt-3">
            <FormField label="Наименование справочника" required>
              <Input
                placeholder="например, Группы взаимозаменяемости ТМЦ"
                value={fieldForm.label}
                onChange={(e) => setFieldForm((p) => ({ ...p, label: e.target.value }))}
              />
            </FormField>

            <FormField label="Системный код (латиница)" required>
              <Input
                placeholder="например, tmc_groups"
                value={fieldForm.key}
                onChange={(e) => setFieldForm((p) => ({ ...p, key: e.target.value }))}
              />
            </FormField>

            <FormField label="Описание">
              <Input
                placeholder="Краткое назначение справочника..."
                value={fieldForm.description}
                onChange={(e) => setFieldForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setShowFieldModal(false)}>
                Отмена
              </Button>
              <Button type="submit">
                Создать справочник
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: Reference Value */}
        <Modal open={showValueModal} onClose={() => setShowValueModal(false)}>
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#17243a] dark:text-slate-100">
              Добавление элемента в: {activeCategory?.label || "Справочник"}
            </h2>
            <p className="text-[11px] text-slate-500">Укажите значение и код нового справочного элемента</p>
          </div>

          <form onSubmit={handleSaveReferenceValue} className="space-y-4 mt-3">
            <FormField label="Отображаемое наименование" required>
              <Input
                placeholder="например, Склад №4 (Высотный хаб)"
                value={valueForm.label}
                onChange={(e) => setValueForm((p) => ({ ...p, label: e.target.value }))}
              />
            </FormField>

            <FormField label="Код элемента / Системный ключ" required>
              <Input
                placeholder="например, WH_HIGH_BAY"
                value={valueForm.value}
                onChange={(e) => setValueForm((p) => ({ ...p, value: e.target.value }))}
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setShowValueModal(false)}>
                Отмена
              </Button>
              <Button type="submit">
                Добавить элемент
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
