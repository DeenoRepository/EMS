export interface NavItem {
  id: string;
  title: string;
  href: string;
  category: "Главная" | "Бизнес-модули" | "EPS" | "Администрирование" | "Настройки EPS" | "Настройки WMS" | "Действие";
  keywords: string[];
  iconName?: string;
  badge?: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "nav-dashboard",
    title: "Обзор Платформы",
    href: "/",
    category: "Главная",
    keywords: ["главная", "обзор", "дашборд", "shell", "dashboard", "home", "main"],
    iconName: "LayoutDashboard"
  },
  {
    id: "nav-eps-root",
    title: "Паспортизация оборудования (EPS)",
    href: "/modules/eps",
    category: "Бизнес-модули",
    keywords: ["eps", "паспортизация", "реестр оборудования", "оборудование", "паспорт"],
    iconName: "Server",
    children: [
      {
        id: "nav-eps-registry",
        title: "Реестр оборудования",
        href: "/modules/eps",
        category: "EPS",
        keywords: ["реестр", "оборудование", "список", "паспорта", "registry", "equipment"],
        iconName: "Box"
      },
      {
        id: "nav-eps-documents",
        title: "Документы",
        href: "/modules/eps/documents",
        category: "EPS",
        keywords: ["документы", "схемы", "чертежи", "файлы", "documents", "files"],
        iconName: "FileText"
      },
      {
        id: "nav-eps-reports",
        title: "Отчёты",
        href: "/modules/eps/reports",
        category: "EPS",
        keywords: ["отчёты", "аналитика", "статистика", "выгрузка", "reports", "analytics"],
        iconName: "BarChart3"
      },
      {
        id: "nav-eps-approvals",
        title: "Очередь согласований",
        href: "/modules/eps/approval-queue",
        category: "EPS",
        keywords: ["очередь", "согласование", "согласований", "заявки", "approval", "queue", "pending"],
        iconName: "ClipboardCheck"
      },
      {
        id: "nav-eps-history",
        title: "История изменений",
        href: "/modules/eps/change-history",
        category: "EPS",
        keywords: ["история", "изменения", "аудит", "лог", "history", "audit", "logs"],
        iconName: "Activity"
      }
    ]
  },
  {
    id: "nav-wms-root",
    title: "WMS Складской учет",
    href: "/modules/wms",
    category: "Бизнес-модули",
    keywords: ["wms", "склад", "тмц", "остатки", "ячейки", "запчасти", "складской учет"],
    iconName: "Warehouse",
    children: [
      {
        id: "nav-wms-dashboard",
        title: "Дашборд & Каталог ТМЦ",
        href: "/modules/wms",
        category: "Бизнес-модули",
        keywords: ["дашборд", "обзор", "склад", "wms", "dashboard", "остатки", "каталог", "тмц", "запчасти"],
        iconName: "LayoutDashboard"
      },
      {
        id: "nav-wms-warehouses",
        title: "Склады & Ячейки",
        href: "/modules/wms/warehouses",
        category: "Бизнес-модули",
        keywords: ["склады", "ячейки", "топология", "стеллажи", "хранение"],
        iconName: "Warehouse"
      },
      {
        id: "nav-wms-movements",
        title: "Движения & Списание",
        href: "/modules/wms/movements",
        category: "Бизнес-модули",
        keywords: ["приход", "расход", "перемещение", "списание", "оборудование"],
        iconName: "History"
      }
    ]
  },
  {
    id: "nav-eps-new",
    title: "Создание нового паспорта оборудования",
    href: "/modules/eps/new",
    category: "Действие",
    keywords: ["создать", "добавить", "новый паспорт", "create", "new", "equipment"],
    iconName: "Zap"
  },
  {
    id: "nav-settings-root",
    title: "Настройки",
    href: "/admin/settings",
    category: "Администрирование",
    keywords: ["настройки", "администрирование", "конфигурация", "settings", "admin"],
    iconName: "Settings2",
    children: [
      {
        id: "nav-admin-settings",
        title: "Основные настройки",
        href: "/admin/settings",
        category: "Администрирование",
        keywords: ["основные", "параметры", "платформа", "general", "settings"],
        iconName: "SlidersHorizontal"
      },
      {
        id: "nav-admin-rbac",
        title: "Безопасность & RBAC",
        href: "/admin/rbac",
        category: "Администрирование",
        keywords: ["rbac", "безопасность", "роли", "права", "пользователи", "security", "roles", "users"],
        iconName: "ShieldCheck"
      },
      {
        id: "nav-admin-eps-nsi",
        title: "НСИ & Справочники EPS",
        href: "/admin/settings/eps",
        category: "Настройки EPS",
        keywords: ["нси", "справочники", "атрибуты", "типы", "references", "attributes"],
        iconName: "Database"
      },
      {
        id: "nav-admin-audit",
        title: "Аудит и Мониторинг",
        href: "/admin/audit",
        category: "Администрирование",
        keywords: ["аудит", "мониторинг", "телеметрия", "логи", "health", "audit", "logs", "metrics"],
        iconName: "Gauge"
      }
    ]
  }
];
