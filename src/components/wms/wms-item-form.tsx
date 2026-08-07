"use client";

import React, { useState, useEffect } from "react";
import { Box } from "lucide-react";
import { WmsItem, WAREHOUSES_REGISTRY, getWarehouseResponsibleUser, canUserManageItem } from "@/lib/modules/wms-store";
import { useShell } from "@/components/layout/shell-context";
import {
  Modal,
  ModalHeader,
  ModalFooter,
  FormSection,
  FormField,
  Input,
  Select,
  Textarea,
  KeyValueEditor,
  KeyValuePair,
  AutocompleteInput,
  AutocompleteOption,
} from "@/components/ui";

interface WmsItemFormProps {
  initialData?: Partial<WmsItem>;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (item: WmsItem) => void;
  existingItems?: WmsItem[];
}

export default function WmsItemForm({ initialData, isOpen, onClose, onSubmitSuccess, existingItems = [] }: WmsItemFormProps) {
  const { currentUser } = useShell();

  const [sku, setSku] = useState(() => initialData?.sku || "");
  const [name, setName] = useState(() => initialData?.name || "");
  const [category, setCategory] = useState(() => initialData?.category || "Подшипники");
  const [type, setType] = useState<WmsItem["type"]>(() => initialData?.type || "ZIP");
  const [unit, setUnit] = useState<WmsItem["unit"]>(() => initialData?.unit || "pcs");
  const [warehouse, setWarehouse] = useState(() => initialData?.warehouse || "Основной склад ЗИП");
  const [cell, setCell] = useState(() => initialData?.cell || "");
  const [quantity, setQuantity] = useState<number>(() => initialData?.quantity || 0);
  const [minQuantity, setMinQuantity] = useState<number>(() => initialData?.minQuantity || 5);
  const [maxQuantity, setMaxQuantity] = useState<number>(() => initialData?.maxQuantity || 50);
  const [reservedQuantity, setReservedQuantity] = useState<number>(() => initialData?.reservedQuantity || 0);
  const [unitPrice, setUnitPrice] = useState<number>(() => initialData?.unitPrice || 0);
  const [supplier, setSupplier] = useState(() => initialData?.supplier || "");
  const [responsibleUser, setResponsibleUser] = useState(() =>
    initialData?.responsibleUser || getWarehouseResponsibleUser(initialData?.warehouse || "Основной склад ЗИП")
  );
  const [description, setDescription] = useState(() => initialData?.description || "");
  const [barcode, setBarcode] = useState(() => initialData?.barcode || "");
  const [compatibleEq, setCompatibleEq] = useState<string>(() => (initialData?.compatibleEquipment || []).join(", "));
  const [specsPairs, setSpecsPairs] = useState<KeyValuePair[]>(() => {
    if (initialData?.techSpecs) {
      return Object.entries(initialData.techSpecs).map(([key, value]) => ({ key, value }));
    }
    return [{ key: "материал", value: "" }, { key: "размер", value: "" }];
  });

  const [warehousesList, setWarehousesList] = useState<Array<{ name: string; responsibleUser: string }>>([
    { name: "Основной склад ЗИП", responsibleUser: "Смирнов А.В. (Старший кладовщик)" },
    { name: "Склад ГСМ №2", responsibleUser: "Ковалев Д.М. (Кладовщик ГСМ)" },
    { name: "Цеховая кладовая №3", responsibleUser: "Сидоров А.Н. (Энергетик цеха)" }
  ]);

  useEffect(() => {
    fetch("/api/admin/warehouses")
      .then((res) => res.json())
      .then((data) => {
        if (data.warehouses && Array.isArray(data.warehouses) && data.warehouses.length > 0) {
          setWarehousesList(data.warehouses);
        }
      })
      .catch(() => {});
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyExistingItem = (item: WmsItem) => {
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setType(item.type);
    setUnit(item.unit);
    setWarehouse(item.warehouse);
    setCell(item.cell);
    setMinQuantity(item.minQuantity);
    setMaxQuantity(item.maxQuantity);
    setUnitPrice(item.unitPrice);
    if (item.supplier) setSupplier(item.supplier);
    if (item.responsibleUser) setResponsibleUser(item.responsibleUser);
    if (item.description) setDescription(item.description);
    if (item.barcode) setBarcode(item.barcode);
    if (item.compatibleEquipment) setCompatibleEq(item.compatibleEquipment.join(", "));
    if (item.techSpecs) {
      setSpecsPairs(Object.entries(item.techSpecs).map(([key, value]) => ({ key, value })));
    }
  };

  const handleWarehouseChange = (newWarehouse: string) => {
    setWarehouse(newWarehouse);
    const defaultMol = getWarehouseResponsibleUser(newWarehouse);
    setResponsibleUser(defaultMol);
  };

  const autocompleteOptions: AutocompleteOption<WmsItem>[] = existingItems.map((item) => ({
    id: item.id || item.sku,
    label: item.name,
    sublabel: `SKU: ${item.sku} | ${item.category}`,
    data: item,
  }));

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError("Укажите наименование позиций ТМЦ/ЗИП");
      return;
    }

    setLoading(true);
    setError(null);

    const techSpecsObj: Record<string, string> = {};
    specsPairs.forEach((s) => {
      if (s.key.trim() && s.value.trim()) {
        techSpecsObj[s.key.trim()] = s.value.trim();
      }
    });

    if (!canUserManageItem(currentUser, warehouse)) {
      const respUser = getWarehouseResponsibleUser(warehouse);
      setError(`Отказ в доступе! Вы не являетесь МОЛ склада "${warehouse}". Ответственное лицо: ${respUser}`);
      setLoading(false);
      return;
    }

    const payload = {
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      category,
      type,
      unit,
      warehouse,
      cell: cell.trim() || "Не указана",
      quantity: Number(quantity) || 0,
      minQuantity: Number(minQuantity) || 0,
      maxQuantity: Number(maxQuantity) || 0,
      reservedQuantity: Number(reservedQuantity) || 0,
      unitPrice: Number(unitPrice) || 0,
      supplier: supplier.trim(),
      responsibleUser: responsibleUser.trim(),
      description: description.trim(),
      barcode: barcode.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      compatibleEquipment: compatibleEq.split(",").map((s) => s.trim()).filter(Boolean),
      techSpecs: techSpecsObj,
    };

    try {
      const res = await fetch("/api/modules/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Ошибка при сохранении позиции ТМЦ");

      const data = await res.json();
      onSubmitSuccess(data.item);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось сохранить ТМЦ";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        icon={<Box size={16} />}
        title={initialData?.id ? "Редактирование карточки ТМЦ / ЗИП" : "Создание новой карточки ТМЦ / ЗИП"}
        subtitle="WMS Складской учёт • Форма паспортизации ТМЦ"
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs pr-1">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-medium text-rose-600">
            {error}
          </div>
        )}

        <FormSection title="1. Идентификация и классификация ТМЦ" icon={<Box size={14} className="text-[#3473d4]" />} cols={3}>
          <FormField label="Артикул / SKU" required>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU-BRG-6204-RS"
              mono
            />
          </FormField>

          <FormField label="Наименование ТМЦ / ЗИП" required className="col-span-2">
            <AutocompleteInput
              value={name}
              onChange={setName}
              options={autocompleteOptions}
              onSelect={(opt) => applyExistingItem(opt.data as WmsItem)}
              placeholder="Подшипник шариковый радиальный 6204-2RS SKF"
            />
          </FormField>

          <FormField label="Категория">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Подшипники">Подшипники</option>
              <option value="Гидравлика">Гидравлика</option>
              <option value="Электроника">Электроника</option>
              <option value="Пневматика">Пневматика</option>
              <option value="Механика">Механика</option>
              <option value="Смазочные материалы">Смазочные материалы</option>
              <option value="Инструмент">Инструмент</option>
            </Select>
          </FormField>

          <FormField label="Тип позиции">
            <Select value={type} onChange={(e) => setType(e.target.value as WmsItem["type"])}>
              <option value="ZIP">ЗИП / Запасная часть</option>
              <option value="RAW_MATERIAL">Сырьё и материалы</option>
              <option value="CONSUMABLE">Расходный материал</option>
              <option value="EQUIPMENT">Оборудование / Агрегат</option>
            </Select>
          </FormField>

          <FormField label="Единица измерения">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as WmsItem["unit"])}>
              <option value="pcs">шт (штуки)</option>
              <option value="kg">кг (килограммы)</option>
              <option value="meters">м (метры)</option>
              <option value="liters">л (литры)</option>
              <option value="sets">компл (комплекты)</option>
            </Select>
          </FormField>
        </FormSection>

        <FormSection title="2. Складское размещение и остатки" icon={<Box size={14} className="text-emerald-600" />} cols={3}>
          <FormField label="Склад хранения" required>
            <Select value={warehouse} onChange={(e) => handleWarehouseChange(e.target.value)}>
              {warehousesList.map((wh) => (
                <option key={wh.name} value={wh.name}>
                  {wh.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Ячейка / Стелаж">
            <Input
              value={cell}
              onChange={(e) => setCell(e.target.value)}
              placeholder="A-12-04"
              mono
            />
          </FormField>

          <FormField label="Ответственное лицо (МОЛ)">
            <Input value={responsibleUser} onChange={(e) => setResponsibleUser(e.target.value)} />
          </FormField>

          <FormField label="Текущий остаток">
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              mono
            />
          </FormField>

          <FormField label="Мин. порог (Страховой)">
            <Input
              type="number"
              value={minQuantity}
              onChange={(e) => setMinQuantity(Number(e.target.value))}
              mono
            />
          </FormField>

          <FormField label="Макс. вместимость">
            <Input
              type="number"
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(Number(e.target.value))}
              mono
            />
          </FormField>
        </FormSection>

        <FormSection title="3. Учётная стоимость и поставка" icon={<Box size={14} className="text-amber-600" />} cols={2}>
          <FormField label="Учётная цена за ед. (руб.)">
            <Input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              mono
            />
          </FormField>

          <FormField label="Поставщик / Изготовитель">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ООО ПромышленныйПоставщик" />
          </FormField>

          <FormField label="Штрихкод / QR-код">
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} mono />
          </FormField>

          <FormField label="Совместимое оборудование">
            <Input value={compatibleEq} onChange={(e) => setCompatibleEq(e.target.value)} placeholder="HAAS VF-2, DMG MORI" />
          </FormField>
        </FormSection>

        <FormSection title="4. Технические характеристики" icon={<Box size={14} className="text-violet-600" />} cols={1}>
          <KeyValueEditor value={specsPairs} onChange={setSpecsPairs} />
        </FormSection>

        <FormSection title="5. Дополнительные примечания" icon={<Box size={14} className="text-slate-500" />} cols={1}>
          <FormField label="Описание">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Дополнительная информация..." />
          </FormField>
        </FormSection>
      </form>

      <ModalFooter
        onCancel={onClose}
        onSubmit={() => handleSubmit()}
        submitLabel="Сохранить ТМЦ"
        submitting={loading}
      />
    </Modal>
  );
}
