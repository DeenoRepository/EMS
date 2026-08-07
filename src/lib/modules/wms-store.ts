export interface WmsItem {
  id: string;
  sku: string; // Артикул ТМЦ/ЗИП
  name: string;
  category: string; // Подшипники, Смазочные материалы, Электроника, Гидравлика, Механика, Метизы, Спецодежда
  type: "ZIP" | "CONSUMABLE" | "TOOL" | "EQUIPMENT_PART" | "PPE"; // ЗИП, Расходник, Инструмент, Запчасть, СИЗ
  unit: "pcs" | "kg" | "l" | "m" | "set" | "box"; // ед. измерения
  warehouse: string; // Основной склад, Склад №2, Цеховая кладовая №3
  cell: string; // Стеллаж 4, Ячейка B-12
  quantity: number; // Текущий остаток
  minQuantity: number; // Минимальный неснижаемый остаток
  maxQuantity: number; // Максимальная вместимость / норма
  reservedQuantity: number; // Зарезервировано под плановый ремонт
  unitPrice: number; // Цена за единицу (руб.)
  currency: string; // RUB
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCKED";
  supplier?: string;
  compatibleEquipment?: string[]; // Список кодов или ID оборудования EPS (напр. EQ-CNC-2026-01)
  lastIncomingDate?: string;
  lastOutgoingDate?: string;
  responsibleUser?: string;
  description?: string;
  techSpecs?: Record<string, string>;
  barcode?: string;
  updatedAt: string;
}

export interface WmsMovement {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  type: "INCOMING" | "OUTGOING" | "TRANSFER" | "RESERVE" | "ADJUSTMENT" | "PERSONAL_CARD";
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  performedBy: string;
  recipientUser?: string; // Сотрудник (для выдачи на личную карточку / СИЗ / инструмент)
  reason?: string;
  relatedOrderOrEq?: string; // Напр. Ремонт EQ-CNC-2026-01 или Заказ-наряд #49102
  timestamp: string;
}

export interface WmsTransferRequest {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  requestedByUsername?: string;
  targetMolUser: string;
  targetMolUsername?: string;
  reason?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export const MOCK_WMS_TRANSFER_REQUESTS: WmsTransferRequest[] = [
  {
    id: "tr-1001",
    itemId: "wms-001",
    itemSku: "SKU-BRG-6204-RS",
    itemName: "Подшипник шариковый радиальный 6204-2RS SKF",
    quantity: 5,
    fromWarehouse: "Основной склад ЗИП",
    toWarehouse: "Цеховая кладовая №3",
    requestedBy: "Сидоров А.Н. (Энергетик цеха)",
    requestedByUsername: "approver",
    targetMolUser: "Смирнов А.В. (Старший кладовщик)",
    targetMolUsername: "admin",
    reason: "Плановая замена подшипников токарного станка EQ-CNC-2026-01",
    status: "PENDING",
    createdAt: "2026-08-07T09:30:00Z",
    updatedAt: "2026-08-07T09:30:00Z"
  },
  {
    id: "tr-1002",
    itemId: "wms-002",
    itemSku: "SKU-OIL-MOBIL-VACTRA2",
    itemName: "Масло направляющих скольжения Mobil Vactra No.2 (20л)",
    quantity: 2,
    fromWarehouse: "Склад ГСМ №2",
    toWarehouse: "Основной склад ЗИП",
    requestedBy: "Смирнов А.В. (Старший кладовщик)",
    requestedByUsername: "admin",
    targetMolUser: "Ковалев Д.М. (Кладовщик ГСМ)",
    targetMolUsername: "editor",
    reason: "Пополнение оперативного резерва перед ТО цеха №1",
    status: "PENDING",
    createdAt: "2026-08-07T11:15:00Z",
    updatedAt: "2026-08-07T11:15:00Z"
  }
];

export interface WarehouseConfig {
  id: string;
  name: string;
  responsibleUser: string;
  responsibleUsername?: string;
}

export const WAREHOUSES_REGISTRY: WarehouseConfig[] = [
  { id: "wh-1", name: "Основной склад ЗИП", responsibleUser: "Смирнов А.В. (Старший кладовщик)", responsibleUsername: "admin" },
  { id: "wh-2", name: "Склад ГСМ №2", responsibleUser: "Ковалев Д.М. (Кладовщик ГСМ)", responsibleUsername: "editor" },
  { id: "wh-3", name: "Цеховая кладовая №3", responsibleUser: "Сидоров А.Н. (Энергетик цеха)", responsibleUsername: "approver" }
];

export function getWarehouseResponsibleUser(warehouseName: string): string {
  const found = WAREHOUSES_REGISTRY.find((w) => w.name === warehouseName);
  return found ? found.responsibleUser : "Смирнов А.В. (Старший кладовщик)";
}

export function canUserManageItem(
  user: { username?: string; displayName?: string; roles?: string[] } | null,
  itemOrWarehouse: WmsItem | string
): boolean {
  if (!user) return false;
  // Администраторы системы имеют полный доступ ко всем складам
  if (user.roles?.includes("ADMIN")) return true;

  const warehouseName = typeof itemOrWarehouse === "string" ? itemOrWarehouse : itemOrWarehouse.warehouse;
  const wh = WAREHOUSES_REGISTRY.find((w) => w.name === warehouseName);
  
  if (wh) {
    if (wh.responsibleUsername && user.username === wh.responsibleUsername) return true;
    if (user.displayName && wh.responsibleUser.toLowerCase().includes(user.displayName.toLowerCase())) return true;
  }

  // Также проверяем явно указанного МОЛ в самой карточке ТМЦ
  if (typeof itemOrWarehouse !== "string" && itemOrWarehouse.responsibleUser) {
    if (user.displayName && itemOrWarehouse.responsibleUser.toLowerCase().includes(user.displayName.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export function filterWmsItems(items: WmsItem[], searchQuery: string): WmsItem[] {
  if (!searchQuery || !searchQuery.trim()) return items;
  const q = searchQuery.toLowerCase().trim();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.includes(q))
  );
}

export const MOCK_WMS_ITEMS: WmsItem[] = [
  {
    id: "wms-001",
    sku: "SKU-BRG-6204-RS",
    name: "Подшипник шариковый радиальный 6204-2RS SKF",
    category: "Подшипники",
    type: "ZIP",
    unit: "pcs",
    warehouse: "Основной склад ЗИП",
    cell: "Стеллаж A-04 / Ячейка 12",
    quantity: 48,
    minQuantity: 15,
    maxQuantity: 100,
    reservedQuantity: 8,
    unitPrice: 1250,
    currency: "RUB",
    status: "IN_STOCK",
    supplier: "ООО СпецПодшипник Торг",
    compatibleEquipment: ["EQ-CNC-2026-01", "EQ-PRESS-2026-04"],
    lastIncomingDate: "2026-07-20",
    lastOutgoingDate: "2026-08-04",
    responsibleUser: "Смирнов А.В. (Старший кладовщик)",
    description: "Шарикоподшипник с двухсторонним резиновым уплотнением для шпиндельных узлов и электроприводов.",
    barcode: "4607012948120",
    techSpecs: {
      "внутренний_диаметр": "20 мм",
      "внешний_диаметр": "47 мм",
      "ширина": "14 мм",
      "класс_точности": "ISO P6"
    },
    updatedAt: "2026-08-05T14:20:00Z"
  },
  {
    id: "wms-002",
    sku: "SKU-OIL-MOBIL-VACTRA2",
    name: "Масло направляющих скольжения Mobil Vactra No.2 (20л)",
    category: "Смазочные материалы",
    type: "CONSUMABLE",
    unit: "l",
    warehouse: "Склад ГСМ №2",
    cell: "Стеллаж G-01 / Бочка 03",
    quantity: 12,
    minQuantity: 40,
    maxQuantity: 200,
    reservedQuantity: 5,
    unitPrice: 850,
    currency: "RUB",
    status: "LOW_STOCK",
    supplier: "ООО ПромМасла Центр",
    compatibleEquipment: ["EQ-CNC-2026-01"],
    lastIncomingDate: "2026-06-15",
    lastOutgoingDate: "2026-08-05",
    responsibleUser: "Ковалев Д.М. (Кладовщик ГСМ)",
    description: "Высококачественное масло премиум-класса для смазки направляющих станочного оборудования.",
    barcode: "4607012948991",
    techSpecs: {
      "вязкость_40C": "68 cSt",
      "температура_вспышки": "228 °C",
      "плотность": "0.883 г/см³"
    },
    updatedAt: "2026-08-05T16:45:00Z"
  },
  {
    id: "wms-003",
    sku: "SKU-HYD-SEAL-P6334",
    name: "Ремкомплект гидравлических уплотнений пресса П6334",
    category: "Гидравлика",
    type: "ZIP",
    unit: "set",
    warehouse: "Основной склад ЗИП",
    cell: "Стеллаж H-02 / Ячейка 05",
    quantity: 2,
    minQuantity: 3,
    maxQuantity: 10,
    reservedQuantity: 2,
    unitPrice: 18400,
    currency: "RUB",
    status: "LOW_STOCK",
    supplier: "АО Тяжмехпресс",
    compatibleEquipment: ["EQ-PRESS-2026-04"],
    lastIncomingDate: "2026-05-10",
    lastOutgoingDate: "2026-08-02",
    responsibleUser: "Смирнов А.В. (Старший кладовщик)",
    description: "Оригинальный комплект полиуретановых манжет и уплотнений поршня гидроцилиндра.",
    barcode: "4607012948773",
    techSpecs: {
      "материал": "Полиуретан / NBR",
      "рабочее_давление": "до 32 МПа",
      "температурный_диапазон": "от -30 до +100 °C"
    },
    updatedAt: "2026-08-02T11:10:00Z"
  },
  {
    id: "wms-004",
    sku: "SKU-FILT-ATLAS-GA37",
    name: "Масляный фильтр компрессора Atlas Copco GA37",
    category: "Расходные элементы",
    type: "CONSUMABLE",
    unit: "pcs",
    warehouse: "Цеховая кладовая №3",
    cell: "Полка 03 / Ячейка C",
    quantity: 0,
    minQuantity: 4,
    maxQuantity: 20,
    reservedQuantity: 0,
    unitPrice: 4200,
    currency: "RUB",
    status: "OUT_OF_STOCK",
    supplier: "ООО Компрессор Технологии",
    compatibleEquipment: ["EQ-COMP-2026-09"],
    lastIncomingDate: "2026-04-01",
    lastOutgoingDate: "2026-07-28",
    responsibleUser: "Сидоров А.Н. (Энергетик цеха)",
    description: "Фильтрующий элемент системы смазки винтового компрессора.",
    barcode: "4607012948332",
    techSpecs: {
      "тонкость_фильтрации": "10 мкм",
      "максимальное_давление": "15 бар"
    },
    updatedAt: "2026-07-28T09:30:00Z"
  },
  {
    id: "wms-005",
    sku: "SKU-ELEC-RELAY-24V",
    name: "Реле промежутельное Finder 40.52 24V DC",
    category: "Электроника",
    type: "ZIP",
    unit: "pcs",
    warehouse: "Основной склад ЗИП",
    cell: "Стеллаж E-01 / Блок 14",
    quantity: 120,
    minQuantity: 20,
    maxQuantity: 80,
    reservedQuantity: 10,
    unitPrice: 650,
    currency: "RUB",
    status: "OVERSTOCKED",
    supplier: "ООО ЭлектроКомплект",
    compatibleEquipment: ["EQ-CNC-2026-01", "EQ-PRESS-2026-04", "EQ-COMP-2026-09"],
    lastIncomingDate: "2026-08-01",
    lastOutgoingDate: "2026-08-03",
    responsibleUser: "Смирнов А.В. (Старший кладовщик)",
    description: "Двухполюсное миниатюрное реле для печатных плат и розеток Finder.",
    barcode: "4607012948554",
    techSpecs: {
      "напряжение_катушки": "24 V DC",
      "номинальный_ток": "8 A",
      "контакты": "2CO (DPDT)"
    },
    updatedAt: "2026-08-03T15:00:00Z"
  }
];

export const MOCK_WMS_MOVEMENTS: WmsMovement[] = [
  {
    id: "mov-001",
    itemId: "wms-001",
    itemSku: "SKU-BRG-6204-RS",
    itemName: "Подшипник шариковый радиальный 6204-2RS SKF",
    type: "OUTGOING",
    quantity: 4,
    fromLocation: "Основной склад ЗИП",
    toLocation: "Цех №3 (Ремонт EQ-CNC-2026-01)",
    performedBy: "Смирнов А.В.",
    reason: "Замена подшипника шпиндельного узла фрезерного станка",
    relatedOrderOrEq: "EQ-CNC-2026-01",
    timestamp: "2026-08-04T11:30:00Z"
  },
  {
    id: "mov-002",
    itemId: "wms-002",
    itemSku: "SKU-OIL-MOBIL-VACTRA2",
    type: "OUTGOING",
    quantity: 10,
    itemName: "Масло направляющих скольжения Mobil Vactra No.2 (20л)",
    fromLocation: "Склад ГСМ №2",
    toLocation: "Участок ЧПУ",
    performedBy: "Ковалев Д.М.",
    reason: "Плановая доливка масла в гидростанцию",
    relatedOrderOrEq: "EQ-CNC-2026-01",
    timestamp: "2026-08-05T09:15:00Z"
  },
  {
    id: "mov-003",
    itemId: "wms-005",
    itemSku: "SKU-ELEC-RELAY-24V",
    itemName: "Реле промежутельное Finder 40.52 24V DC",
    type: "INCOMING",
    quantity: 50,
    fromLocation: "ООО ЭлектроКомплект (Поставка №9402)",
    toLocation: "Основной склад ЗИП",
    performedBy: "Смирнов А.В.",
    reason: "Поступление по закупке SRM №8812",
    relatedOrderOrEq: "SRM-PO-8812",
    timestamp: "2026-08-01T14:00:00Z"
  }
];
