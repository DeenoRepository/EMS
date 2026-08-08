import { MODULES_CONFIG, ModuleManifest } from "./modules";

export interface NavItem {
  id: string;
  title: string;
  href: string;
  category: "Главная" | "Бизнес-модули" | "EPS" | "Администрирование" | "Настройки EPS" | "Настройки WMS" | "Действие" | string;
  keywords: string[];
  iconName?: string;
  badge?: string;
  children?: NavItem[];
}

/**
 * Статические универсальные элементы навигации
 */
const BASE_NAV_ITEMS: NavItem[] = [
  {
    id: "nav-dashboard",
    title: "Обзор Платформы",
    href: "/",
    category: "Главная",
    keywords: ["главная", "обзор", "дашборд", "shell", "dashboard", "home", "main"],
    iconName: "LayoutDashboard"
  },
  {
    id: "nav-eps-new",
    title: "Создание нового паспорта оборудования",
    href: "/modules/eps/new",
    category: "Действие",
    keywords: ["создать", "добавить", "новый паспорт", "create", "new", "equipment"],
    iconName: "Zap"
  }
];

/**
 * Генерирует иерархию элементов навигации для настроек администрирования
 */
export function getAdminSettingsNavItems(): NavItem[] {
  const moduleSettingsItems: NavItem[] = Object.values(MODULES_CONFIG).map((mod: ModuleManifest) => ({
    id: `nav-admin-${mod.id}-settings`,
    title: `НСИ ${mod.name}`,
    href: mod.settingsRoute || `/admin/settings/${mod.id}`,
    category: "Администрирование",
    keywords: ["настройки", mod.id, mod.name.toLowerCase(), "конфигурация", "нси"],
    iconName: "Database"
  }));

  return [
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
          title: "Общие",
          href: "/admin/settings",
          category: "Администрирование",
          keywords: ["основные", "параметры", "платформа", "general", "settings", "общие"],
          iconName: "SlidersHorizontal"
        },
        {
          id: "nav-admin-rbac",
          title: "Доступ (RBAC)",
          href: "/admin/rbac",
          category: "Администрирование",
          keywords: ["rbac", "безопасность", "роли", "права", "пользователи", "security", "roles", "users", "доступ"],
          iconName: "ShieldCheck"
        },
        ...moduleSettingsItems,
        {
          id: "nav-admin-audit",
          title: "Аудит",
          href: "/admin/audit",
          category: "Администрирование",
          keywords: ["аудит", "мониторинг", "телеметрия", "логи", "health", "audit", "logs", "metrics"],
          iconName: "Gauge"
        }
      ]
    }
  ];
}

/**
 * Динамически формирует полный список элементов навигации,
 * агрегируя все зарегистрированные бизнес-модули из MODULES_CONFIG.
 */
export function getDynamicNavItems(): NavItem[] {
  const moduleNavRoots: NavItem[] = Object.values(MODULES_CONFIG).map((mod: ModuleManifest) => ({
    id: `nav-${mod.id}-root`,
    title: mod.name,
    href: mod.href,
    category: "Бизнес-модули",
    keywords: [mod.id, mod.name.toLowerCase(), mod.description.toLowerCase()],
    iconName: mod.iconName,
    children: mod.navItems.map((item) => ({
      id: item.id,
      title: item.title,
      href: item.href,
      category: mod.name,
      keywords: item.keywords,
      iconName: item.iconName,
      badge: item.badge
    }))
  }));

  return [
    ...BASE_NAV_ITEMS,
    ...moduleNavRoots,
    ...getAdminSettingsNavItems()
  ];
}

// Экспортируем NAV_ITEMS для обратной совместимости с существующим кодом глобального поиска
export const NAV_ITEMS: NavItem[] = getDynamicNavItems();
