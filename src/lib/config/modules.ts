import { APP_VERSION } from "@/lib/version";
import { Role } from "@/lib/auth/rbac";

export interface ModuleNavItem {
  id: string;
  title: string;
  href: string;
  keywords: string[];
  iconName: string;
  badge?: string;
}

export interface NsiCategory {
  id: string;
  name: string;
  description: string;
  apiEndpoint: string;
}

export interface UISlotConfig {
  slotId: "header.actions" | "sidebar.extra" | "dashboard.widgets" | "entity.actions" | string;
  componentId: string;
  title: string;
  order?: number;
  requiredRoles?: Role[];
}

export interface AICapabilitiesManifest {
  /** Зарезервированный список экспортруемых инструментов для последующей интеграции AI/MCP */
  exportableTools?: string[];
  /** Поддерживаемые интенты действия */
  supportedIntentActions?: string[];
}

export interface ModuleManifest {
  id: string;
  name: string;
  href: string;
  version: string;
  status: "online" | "dev" | "offline";
  description: string;
  iconName: string;
  requiredRoles: Role[];
  healthEndpoint?: string;
  settingsRoute?: string;
  navItems: ModuleNavItem[];
  nsiCategories?: NsiCategory[];
  uiSlots?: UISlotConfig[];
  /** Резерв для будущей интеграции MCP / AI агентов */
  aiCapabilities?: AICapabilitiesManifest;
}

export type ModuleConfig = ModuleManifest;

export const MODULES_CONFIG: Record<string, ModuleManifest> = {
  eps: {
    id: "eps",
    name: "EPS Паспортизация",
    href: "/modules/eps",
    version: `v${APP_VERSION}`,
    status: "online",
    description: "Управление паспортами оборудования и структурой иерархии",
    iconName: "Server",
    requiredRoles: ["ADMIN", "EDITOR", "APPROVER", "VIEWER"],
    healthEndpoint: "/api/modules/eps/health",
    settingsRoute: "/admin/settings/eps",
    navItems: [
      {
        id: "nav-eps-registry",
        title: "Реестр оборудования",
        href: "/modules/eps",
        keywords: ["реестр", "оборудование", "список", "паспорта", "registry", "equipment"],
        iconName: "Box"
      },
      {
        id: "nav-eps-documents",
        title: "Документы",
        href: "/modules/eps/documents",
        keywords: ["документы", "схемы", "чертежи", "файлы", "documents", "files"],
        iconName: "FileText"
      },
      {
        id: "nav-eps-reports",
        title: "Отчёты",
        href: "/modules/eps/reports",
        keywords: ["отчёты", "аналитика", "статистика", "выгрузка", "reports", "analytics"],
        iconName: "BarChart3"
      },
      {
        id: "nav-eps-approvals",
        title: "Очередь согласований",
        href: "/modules/eps/approval-queue",
        keywords: ["очередь", "согласование", "согласований", "заявки", "approval", "queue", "pending"],
        iconName: "ClipboardCheck"
      },
      {
        id: "nav-eps-history",
        title: "История изменений",
        href: "/modules/eps/change-history",
        keywords: ["история", "изменения", "аудит", "лог", "history", "audit", "logs"],
        iconName: "Activity"
      }
    ],
    nsiCategories: [
      {
        id: "equipment-attributes",
        name: "Атрибуты типов",
        description: "Характеристики оборудования по типам",
        apiEndpoint: "/api/equipment-type-attributes"
      },
      {
        id: "reference-fields",
        name: "Справочники",
        description: "Категории, производители и типы",
        apiEndpoint: "/api/reference/fields"
      }
    ]
  },
  wms: {
    id: "wms",
    name: "WMS Складской учет",
    href: "/modules/wms",
    version: `v${APP_VERSION}`,
    status: "online",
    description: "Управление складами, ячейками хранения, остатками ТМЦ и списанием",
    iconName: "Warehouse",
    requiredRoles: ["ADMIN", "STOREKEEPER"],
    healthEndpoint: "/api/modules/wms/health",
    settingsRoute: "/admin/settings/wms",
    navItems: [
      {
        id: "nav-wms-dashboard",
        title: "Реестр ТМЦ",
        href: "/modules/wms",
        keywords: ["дашборд", "обзор", "склад", "wms", "dashboard", "остатки", "каталог", "тмц", "запчасти"],
        iconName: "LayoutDashboard"
      },
      {
        id: "nav-wms-movements",
        title: "Аудит движений ТМЦ",
        href: "/modules/wms/movements",
        keywords: ["приход", "расход", "перемещение", "списание", "оборудование", "мол", "сиз", "карточки"],
        iconName: "History"
      },
      {
        id: "nav-wms-personal-cards",
        title: "Личные карточки",
        href: "/modules/wms/personal-cards",
        keywords: ["личные карточки", "сиз", "выдача", "сотрудник", "возврат", "персональные карточки"],
        iconName: "UserCheck"
      },
      {
        id: "nav-wms-topology",
        title: "Адресный учет",
        href: "/modules/wms/topology",
        keywords: ["адресное хранение", "ячейки", "стеллажи", "зоны", "topology", "bins", "warehouse"],
        iconName: "MapPin"
      },
      {
        id: "nav-wms-requisitions",
        title: "Запросы со складов",
        href: "/modules/wms/requisitions",
        keywords: ["запросы", "перемещение", "заявки", "межскладской", "requisitions", "transfers"],
        iconName: "ArrowLeftRight"
      },
      {
        id: "nav-wms-toir",
        title: "Резервы & ЗИП",
        href: "/modules/wms/toir-eps",
        keywords: ["неснижаемый остаток", "eps", "тоир", "ппр", "резерв", "зип"],
        iconName: "Wrench"
      }
    ],
    nsiCategories: [
      {
        id: "wms-categories",
        name: "Категории ТМЦ",
        description: "Классификатор материалов и комплектующих",
        apiEndpoint: "/api/modules/wms/categories"
      },
      {
        id: "wms-locations",
        name: "Зоны и склады",
        description: "Топология складских помещений",
        apiEndpoint: "/api/modules/wms/locations"
      }
    ]
  }
};
