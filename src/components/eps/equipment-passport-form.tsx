"use client";

import { useState, useEffect } from "react";
import {
  Barcode,
  Cpu,
  Building2,
  Truck,
  Calendar,
  Layers,
  Save,
} from "lucide-react";

export interface EquipmentFormData {
  name: string;
  equipmentCode: string;
  category: string;
  type: string;
  model: string;
  serialNumber: string;
  inventoryNumber: string;
  department: string;
  location: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  criticality?: string;
  manufacturer?: string;
  supplier?: string;
  countryOfOrigin?: string;
  isImported?: boolean;
  isUnique?: boolean;
  productionDate?: string;
  deliveryDate?: string;
  commissioningDate?: string;
  responsibleUser?: string;
  warrantyExpiration?: string;
  serviceDueDate?: string;
  notes?: string;
  techSpecs?: Record<string, string>;
}

interface EquipmentFormProps {
  initialValues?: Partial<EquipmentFormData>;
  onSubmit: (data: EquipmentFormData) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  showCancel?: boolean;
}

export default function EquipmentPassportForm({
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
  submitLabel = "Сохранить паспорт",
  showCancel = true,
}: EquipmentFormProps) {
  const [name, setName] = useState(initialValues?.name || "");
  const [equipmentCode, setEquipmentCode] = useState(initialValues?.equipmentCode || "");
  const [status, setStatus] = useState<EquipmentFormData["status"]>(initialValues?.status || "ACTIVE");
  const [category, setCategory] = useState(initialValues?.category || "Металлообработка");
  const [type, setType] = useState(initialValues?.type || "Обрабатывающий центр");
  const [model, setModel] = useState(initialValues?.model || "");
  const [serialNumber, setSerialNumber] = useState(initialValues?.serialNumber || "");
  const [inventoryNumber, setInventoryNumber] = useState(initialValues?.inventoryNumber || "");
  
  // Location & Responsibility
  const [department, setDepartment] = useState(initialValues?.department || "Цех №1");
  const [location, setLocation] = useState(initialValues?.location || "");
  const [responsibleUser, setResponsibleUser] = useState(initialValues?.responsibleUser || "");

  // Manufacturer & Supplier
  const [manufacturer, setManufacturer] = useState(initialValues?.manufacturer || "");
  const [supplier, setSupplier] = useState(initialValues?.supplier || "");
  const [countryOfOrigin, setCountryOfOrigin] = useState(initialValues?.countryOfOrigin || "");
  const [isImported, setIsImported] = useState(initialValues?.isImported ?? true);
  const [productionDate, setProductionDate] = useState(initialValues?.productionDate || "");
  const [deliveryDate, setDeliveryDate] = useState(initialValues?.deliveryDate || "");

  // Maintenance & Warranty
  const [commissioningDate, setCommissioningDate] = useState(initialValues?.commissioningDate || "");
  const [warrantyExpiration, setWarrantyExpiration] = useState(initialValues?.warrantyExpiration || "");
  const [serviceDueDate, setServiceDueDate] = useState(initialValues?.serviceDueDate || "");
  const [notes, setNotes] = useState(initialValues?.notes || "");

  // Additional Details
  const [criticality, setCriticality] = useState(initialValues?.criticality || "A");
  const [isUnique, setIsUnique] = useState(initialValues?.isUnique ?? false);

  // Technical Specs
  const [techSpecs, setTechSpecs] = useState<Record<string, string>>(initialValues?.techSpecs || {});
  const [techAttributeSchemas, setTechAttributeSchemas] = useState<Array<{ id: string; key: string; label: string; dataType: string }>>([]);

  useEffect(() => {
    if (type) {
      fetch(`/api/equipment-type-attributes?type=${encodeURIComponent(type)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setTechAttributeSchemas(data);
          } else {
            setTechAttributeSchemas([
              { id: "t1", key: "spindle_speed_rpm", label: "Частота вращения шпинделя", dataType: "TEXT" },
              { id: "t2", key: "cnc_controller_type", label: "Тип стойки ЧПУ", dataType: "TEXT" },
              { id: "t3", key: "spindle_power_kw", label: "Мощность привода шпинделя", dataType: "TEXT" },
              { id: "t4", key: "tool_capacity", label: "Количество инструментов в магазине", dataType: "TEXT" },
            ]);
          }
        })
        .catch(() => {});
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      equipmentCode: equipmentCode || `EQ-${Date.now().toString().slice(-6)}`,
      status,
      category,
      type,
      model,
      serialNumber,
      inventoryNumber,
      department,
      location,
      responsibleUser,
      manufacturer,
      supplier,
      countryOfOrigin,
      isImported,
      isUnique,
      criticality,
      productionDate,
      deliveryDate,
      commissioningDate,
      warrantyExpiration,
      serviceDueDate,
      notes,
      techSpecs,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto min-h-0 flex-1 pr-1">
      {/* Section 1: Passport Identification */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
          <Barcode size={14} className="text-[#3473d4]" /> 1. Паспортные данные
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Код оборудования</label>
            <input
              type="text"
              placeholder="Генерируется автоматически, если не заполнен"
              value={equipmentCode}
              onChange={(e) => setEquipmentCode(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Наименование оборудования *</label>
            <input
              type="text"
              required
              placeholder="Например: Фрезерный станок с ЧПУ HAAS VF-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Статус оборудования</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EquipmentFormData["status"])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold text-emerald-700"
            >
              <option value="ACTIVE">ACTIVE (В эксплуатации)</option>
              <option value="INACTIVE">INACTIVE (В резерве)</option>
              <option value="DRAFT">DRAFT (Черновик)</option>
              <option value="DECOMMISSIONED">DECOMMISSIONED (Списано)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Категория</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Тип оборудования</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Модель</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Заводской № *</label>
            <input
              type="text"
              required
              placeholder="SN-9948271"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Инвентарный № *</label>
            <input
              type="text"
              required
              placeholder="INV-440192"
              value={inventoryNumber}
              onChange={(e) => setInventoryNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Technical Specifications */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500">
            <Cpu size={14} className="text-indigo-600" /> 2. Технические характеристики
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Подгружено из справочника</span>
        </div>

        {techAttributeSchemas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {techAttributeSchemas.map((attr) => (
              <div key={attr.id} className="space-y-1">
                <label className="font-semibold text-slate-600 text-[11px]">{attr.label}</label>
                <input
                  type="text"
                  placeholder="Заполните значение"
                  value={techSpecs[attr.key] || ""}
                  onChange={(e) =>
                    setTechSpecs({
                      ...techSpecs,
                      [attr.key]: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-2 text-slate-400 text-[11px]">
            Нет настроенных атрибутов для данного типа техники
          </div>
        )}
      </div>

      {/* Section 3: Location & Responsibility */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
          <Building2 size={14} className="text-emerald-600" /> 3. Размещение и ответственность
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Подразделение (Цех)</label>
            <input
              type="text"
              placeholder="Цех №3"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Размещение / Пролет</label>
            <input
              type="text"
              placeholder="Участок ЧПУ, поз. 14"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Ответственный сотрудник</label>
            <input
              type="text"
              placeholder="Иванов И.И. (Главный механик)"
              value={responsibleUser}
              onChange={(e) => setResponsibleUser(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Manufacturer & Delivery */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
          <Truck size={14} className="text-amber-600" /> 4. Изготовитель и поставка
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Изготовитель</label>
            <input
              type="text"
              placeholder="HAAS Automation Inc."
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Поставщик</label>
            <input
              type="text"
              placeholder="ООО МеталлоИмпорт Про"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Страна происхождения</label>
            <input
              type="text"
              placeholder="Например: США, Германия, Россия"
              value={countryOfOrigin}
              onChange={(e) => setCountryOfOrigin(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Происхождение техники</label>
            <select
              value={isImported ? "true" : "false"}
              onChange={(e) => setIsImported(e.target.value === "true")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold"
            >
              <option value="false">Отечественное оборудование</option>
              <option value="true">Импортное оборудование</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Дата производства</label>
            <input
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Дата поставки</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Exploitation & Warranty */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
          <Calendar size={14} className="text-violet-600" /> 5. Эксплуатация и гарантия
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Ввод в эксплуатацию</label>
            <input
              type="date"
              value={commissioningDate}
              onChange={(e) => setCommissioningDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Окончание гарантии</label>
            <input
              type="date"
              value={warrantyExpiration}
              onChange={(e) => setWarrantyExpiration(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Дата планового ТО</label>
            <input
              type="date"
              value={serviceDueDate}
              onChange={(e) => setServiceDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-semibold text-slate-600 text-[11px]">Примечания</label>
          <textarea
            rows={2}
            placeholder="Особые отметки или примечания..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Section 6: Additional Details */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
        <div className="flex items-center gap-1.5 font-bold text-[#17243a] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
          <Layers size={14} className="text-teal-600" /> 6. Дополнительные сведения
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Критичность оборудования (ABC)</label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-bold text-rose-700"
            >
              <option value="A">Класс A — Высокая (Критическое)</option>
              <option value="B">Класс B — Средняя</option>
              <option value="C">Класс C — Низкая</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-600 text-[11px]">Уникальность оборудования</label>
            <select
              value={isUnique ? "true" : "false"}
              onChange={(e) => setIsUnique(e.target.value === "true")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-semibold"
            >
              <option value="false">Серийное оборудование</option>
              <option value="true">Уникальное оборудование</option>
            </select>
          </div>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition disabled:opacity-50"
        >
          <Save size={13} />
          {submitting ? "Сохранение…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

