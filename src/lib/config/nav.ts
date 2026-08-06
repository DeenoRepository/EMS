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
    id: "nav-eps-new",
    title: "Создание нового паспорта оборудования",
    href: "/modules/eps/new",
    category: "Действие",
    keywords: ["создать", "добавить", "новый паспорт", "create", "new", "equipment"],
    iconName: "Zap"
  },
  {
    id: "nav-mro",
    title: "ТОиР и Ремонты (MRO)",
    href: "/modules/mro",
    category: "Бизнес-модули",
    keywords: ["mro", "тоир", "ремонты", "обслуживание", "maintenance", "repair"],
    iconName: "Wrench"
  },
  {
    id: "nav-srm",
    title: "Закупки и Поставщики (SRM)",
    href: "/modules/srm",
    category: "Бизнес-модули",
    keywords: ["srm", "закупки", "заявки", "поставщики", "снабжение", "procurement", "suppliers"],
    iconName: "PackageCheck"
  },
  {
    id: "nav-wms",
    title: "Складской учёт (WMS)",
    href: "/modules/wms",
    category: "Бизнес-модули",
    keywords: ["wms", "склад", "зип", "остатки", "хранение", "warehouse", "inventory"],
    iconName: "Database",
    children: [
      {
        id: "nav-wms-registry",
        title: "Реестр ТМЦ и ЗИП",
        href: "/modules/wms",
        category: "Бизнес-модули",
        keywords: ["реестр", "тмц", "зип", "склад", "остатки"],
        iconName: "Box"
      },
      {
        id: "nav-wms-movements",
        title: "Движение ТМЦ",
        href: "/modules/wms/movements",
        category: "Бизнес-модули",
        keywords: ["движение", "приход", "расход", "перемещение", "аудит"],
        iconName: "History"
      },
      {
        id: "nav-wms-reports",
        title: "Отчёты",
        href: "/modules/wms/reports",
        category: "Бизнес-модули",
        keywords: ["отчёты", "ведомость", "дефицит", "abc-анализ"],
        iconName: "PieChart"
      }
    ]
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
        id: "nav-admin-wms-warehouses",
        title: "Склады & МОЛ WMS",
        href: "/admin/settings/wms",
        category: "Настройки WMS",
        keywords: ["wms", "склады", "мол", "заведующий", "ответственный", "настройки склада"],
        iconName: "Building2"
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
