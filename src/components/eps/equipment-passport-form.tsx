"use client";

import { useState, useEffect } from "react";
import {
  Barcode,
  Cpu,
  Building2,
  Truck,
  Calendar,
  Layers,
} from "lucide-react";
import {
  Input,
  Select,
  Textarea,
  FormField,
  FormSection,
  ModalFooter,
  Switch,
} from "@/components/ui";

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
      <FormSection title="1. Паспортные данные" icon={<Barcode size={14} className="text-[#3473d4]" />} cols={2}>
        <FormField label="Код оборудования">
          <Input
            placeholder="Генерируется автоматически, если не заполнен"
            value={equipmentCode}
            onChange={(e) => setEquipmentCode(e.target.value)}
            mono
          />
        </FormField>

        <FormField label="Наименование оборудования" required>
          <Input
            placeholder="Например: Фрезерный станок с ЧПУ HAAS VF-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Статус оборудования">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as EquipmentFormData["status"])}
              className="font-semibold text-emerald-700"
            >
              <option value="ACTIVE">ACTIVE (В эксплуатации)</option>
              <option value="INACTIVE">INACTIVE (В резерве)</option>
              <option value="DRAFT">DRAFT (Черновик)</option>
              <option value="DECOMMISSIONED">DECOMMISSIONED (Списано)</option>
            </Select>
          </FormField>

          <FormField label="Категория">
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </FormField>

          <FormField label="Тип оборудования">
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </FormField>
        </div>

        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Модель">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </FormField>

          <FormField label="Заводской №" required>
            <Input
              placeholder="SN-9948271"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              mono
            />
          </FormField>

          <FormField label="Инвентарный №" required>
            <Input
              placeholder="INV-440192"
              value={inventoryNumber}
              onChange={(e) => setInventoryNumber(e.target.value)}
              mono
            />
          </FormField>
        </div>
      </FormSection>

      {/* Section 2: Technical Specifications */}
      <FormSection
        title="2. Технические характеристики"
        icon={<Cpu size={14} className="text-indigo-600" />}
        badge="Подгружено из справочника"
        cols={2}
      >
        {techAttributeSchemas.length > 0 ? (
          techAttributeSchemas.map((attr) => (
            <FormField key={attr.id} label={attr.label}>
              <Input
                placeholder="Заполните значение"
                value={techSpecs[attr.key] || ""}
                onChange={(e) =>
                  setTechSpecs({
                    ...techSpecs,
                    [attr.key]: e.target.value,
                  })
                }
              />
            </FormField>
          ))
        ) : (
          <div className="py-2 text-slate-400 text-[11px] col-span-2">
            Нет настроенных атрибутов для данного типа техники
          </div>
        )}
      </FormSection>

      {/* Section 3: Location & Responsibility */}
      <FormSection title="3. Размещение и ответственность" icon={<Building2 size={14} className="text-emerald-600" />} cols={3}>
        <FormField label="Подразделение (Цех)">
          <Input
            placeholder="Цех №3"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </FormField>

        <FormField label="Размещение / Пролет">
          <Input
            placeholder="Участок ЧПУ, поз. 14"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>

        <FormField label="Ответственный сотрудник">
          <Input
            placeholder="Иванов И.И. (Главный механик)"
            value={responsibleUser}
            onChange={(e) => setResponsibleUser(e.target.value)}
          />
        </FormField>
      </FormSection>

      {/* Section 4: Manufacturer & Delivery */}
      <FormSection title="4. Изготовитель и поставка" icon={<Truck size={14} className="text-amber-600" />} cols={2}>
        <FormField label="Изготовитель">
          <Input
            placeholder="HAAS Automation Inc."
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />
        </FormField>

        <FormField label="Поставщик">
          <Input
            placeholder="ООО МеталлоИмпорт Про"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </FormField>

        <FormField label="Страна происхождения">
          <Input
            placeholder="Например: США, Германия, Россия"
            value={countryOfOrigin}
            onChange={(e) => setCountryOfOrigin(e.target.value)}
          />
        </FormField>

        <FormField label="Происхождение техники">
          <Select
            value={isImported ? "true" : "false"}
            onChange={(e) => setIsImported(e.target.value === "true")}
            className="font-semibold"
          >
            <option value="false">Отечественное оборудование</option>
            <option value="true">Импортное оборудование</option>
          </Select>
        </FormField>

        <FormField label="Дата производства">
          <Input
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            mono
          />
        </FormField>

        <FormField label="Дата поставки">
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            mono
          />
        </FormField>
      </FormSection>

      {/* Section 5: Exploitation & Warranty */}
      <FormSection title="5. Эксплуатация и гарантия" icon={<Calendar size={14} className="text-violet-600" />} cols={3}>
        <FormField label="Ввод в эксплуатацию">
          <Input
            type="date"
            value={commissioningDate}
            onChange={(e) => setCommissioningDate(e.target.value)}
            mono
          />
        </FormField>

        <FormField label="Окончание гарантии">
          <Input
            type="date"
            value={warrantyExpiration}
            onChange={(e) => setWarrantyExpiration(e.target.value)}
            mono
          />
        </FormField>

        <FormField label="Дата планового ТО">
          <Input
            type="date"
            value={serviceDueDate}
            onChange={(e) => setServiceDueDate(e.target.value)}
            mono
          />
        </FormField>

        <FormField label="Примечания" className="col-span-3">
          <Textarea
            rows={2}
            placeholder="Особые отметки или примечания..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>
      </FormSection>

      {/* Section 6: Additional Details */}
      <FormSection title="6. Дополнительные сведения" icon={<Layers size={14} className="text-teal-600" />} cols={2}>
        <FormField label="Критичность оборудования (ABC)">
          <Select
            value={criticality}
            onChange={(e) => setCriticality(e.target.value)}
            className="font-bold text-rose-700"
          >
            <option value="A">Класс A — Высокая (Критическое)</option>
            <option value="B">Класс B — Средняя</option>
            <option value="C">Класс C — Низкая</option>
          </Select>
        </FormField>

        <FormField label="Уникальность оборудования">
          <Switch
            label={isUnique ? "Уникальное оборудование" : "Серийное оборудование"}
            checked={isUnique}
            onChange={setIsUnique}
            className="pt-2"
          />
        </FormField>
      </FormSection>

      {/* Form Action Buttons */}
      <ModalFooter
        onCancel={showCancel ? onCancel : undefined}
        onSubmit={() => {}}
        submitLabel={submitLabel}
        submitting={submitting}
      />
    </form>
  );
}
