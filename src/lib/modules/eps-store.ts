export interface EquipmentItem {
  id: string;
  equipmentCode: string;
  name: string;
  type: string;
  category: string;
  model: string;
  serialNumber: string;
  inventoryNumber: string;
  department: string;
  location: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  lifecycleStage: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
  criticality?: "A" | "B" | "C" | string;
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
  version: number;
  updatedAt: string;
}

export const MOCK_EQUIPMENT_DATA: EquipmentItem[] = [
  {
    id: "eq-001",
    equipmentCode: "EQ-CNC-2026-01",
    name: "Фрезерный станок с ЧПУ HAAS VF-2",
    type: "Обрабатывающий центр",
    category: "Металлообработка",
    model: "VF-2SS",
    serialNumber: "SN-9948271",
    inventoryNumber: "INV-440192",
    department: "Цех №3",
    location: "Участок ЧПУ, поз. 14",
    status: "ACTIVE",
    lifecycleStage: "IN_OPERATION",
    criticality: "A",
    manufacturer: "HAAS Automation Inc.",
    supplier: "ООО МеталлоИмпорт Про",
    countryOfOrigin: "США",
    isImported: true,
    isUnique: true,
    productionDate: "2024-03-15",
    deliveryDate: "2024-04-10",
    commissioningDate: "2024-05-01",
    responsibleUser: "Иванов И.И. (Главный механик)",
    warrantyExpiration: "2027-05-01",
    serviceDueDate: "2026-09-15",
    notes: "Проведен плановый ремонт шпиндельного узла. Вся документация проверена.",
    techSpecs: {
      "spindle_speed_rpm": "12 000 об/мин",
      "cnc_controller_type": "HAAS NGC",
      "spindle_power_kw": "22.4 кВт",
      "tool_capacity": "30 шт."
    },
    version: 1,
    updatedAt: "2026-08-01T10:00:00Z"
  },
  {
    id: "eq-002",
    equipmentCode: "EQ-PRESS-2026-04",
    name: "Гидравлический пресс П6334",
    type: "Прессовое оборудование",
    category: "Штамповка",
    model: "П6334Б",
    serialNumber: "SN-1029481",
    inventoryNumber: "INV-110482",
    department: "Цех №1",
    location: "Прессовое отделение, поз. 02",
    status: "ACTIVE",
    lifecycleStage: "MAINTENANCE",
    criticality: "A",
    manufacturer: "АО Тяжмехпресс",
    supplier: "ТД ПромОборудование",
    countryOfOrigin: "Россия",
    isImported: false,
    isUnique: false,
    productionDate: "2023-11-20",
    deliveryDate: "2023-12-15",
    commissioningDate: "2024-01-10",
    responsibleUser: "Петров В.С. (Старший мастер)",
    warrantyExpiration: "2026-01-10",
    serviceDueDate: "2026-08-20",
    notes: "Плановое техническое обслуживание гидросистемы.",
    techSpecs: {
      "nominal_force_tons": "250 тонн",
      "stroke_length_mm": "200 мм",
      "drive_type": "Гидравлический"
    },
    version: 2,
    updatedAt: "2026-08-02T14:30:00Z"
  },
  {
    id: "eq-003",
    equipmentCode: "EQ-COMP-2026-09",
    name: "Винтовой компрессор Atlas Copco GA37",
    type: "Компрессорная станция",
    category: "Энергетика",
    model: "GA37 VSD",
    serialNumber: "SN-8840192",
    inventoryNumber: "INV-994012",
    department: "Энергоцех",
    location: "Компрессорная №2",
    status: "ACTIVE",
    lifecycleStage: "IN_OPERATION",
    criticality: "B",
    manufacturer: "Atlas Copco Airpower",
    supplier: "ООО Компрессор Технологии",
    countryOfOrigin: "Бельгия",
    isImported: true,
    isUnique: false,
    productionDate: "2024-01-10",
    deliveryDate: "2024-02-05",
    commissioningDate: "2024-02-20",
    responsibleUser: "Сидоров А.Н. (Энергетик цеха)",
    warrantyExpiration: "2026-02-20",
    serviceDueDate: "2026-10-05",
    notes: "Своевременная замена масляных фильтров и сепараторов.",
    techSpecs: {
      "working_pressure_bar": "8.5 бар",
      "air_flow_capacity": "6.2 м³/мин",
      "cooling_type": "Воздушное"
    },
    version: 1,
    updatedAt: "2026-07-28T09:15:00Z"
  }
];
