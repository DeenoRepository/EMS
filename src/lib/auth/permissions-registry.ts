export interface PermissionDefinition {
  code: string;
  module: string;
  moduleName: string;
  section: string;
  sectionName: string;
  action: "READ" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT" | "EXECUTE";
  name: string;
  description: string;
}

export interface PermissionModuleGroup {
  moduleId: string;
  moduleName: string;
  sections: {
    sectionId: string;
    sectionName: string;
    permissions: PermissionDefinition[];
  }[];
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // EPS Module
  { code: "eps.equipment.read", module: "eps", moduleName: "EPS Паспортизация", section: "equipment", sectionName: "Реестр оборудования", action: "READ", name: "Просмотр оборудования", description: "Просмотр карточек оборудования и характеристик" },
  { code: "eps.equipment.create", module: "eps", moduleName: "EPS Паспортизация", section: "equipment", sectionName: "Реестр оборудования", action: "CREATE", name: "Создание оборудования", description: "Регистрация новых единиц оборудования" },
  { code: "eps.equipment.update", module: "eps", moduleName: "EPS Паспортизация", section: "equipment", sectionName: "Реестр оборудования", action: "UPDATE", name: "Редактирование оборудования", description: "Изменение характеристик и атрибутов оборудования" },
  { code: "eps.equipment.delete", module: "eps", moduleName: "EPS Паспортизация", section: "equipment", sectionName: "Реестр оборудования", action: "DELETE", name: "Списание оборудования", description: "Списание и вывод оборудования из эксплуатации" },
  { code: "eps.documents.manage", module: "eps", moduleName: "EPS Паспортизация", section: "documents", sectionName: "Документы", action: "UPDATE", name: "Управление документами", description: "Прикрепление чертежей, паспортов и инструкций" },
  { code: "eps.approvals.decide", module: "eps", moduleName: "EPS Паспортизация", section: "approvals", sectionName: "Очередь согласований", action: "APPROVE", name: "Утверждение согласований", description: "Согласование и отклонение версий оборудования и актов" },
  { code: "eps.reports.export", module: "eps", moduleName: "EPS Паспортизация", section: "reports", sectionName: "Отчёты", action: "EXPORT", name: "Экспорт отчётов EPS", description: "Выгрузка сводных отчетов по оборудованию" },

  // WMS Module
  { code: "wms.items.read", module: "wms", moduleName: "WMS Складской учет", section: "items", sectionName: "Реестр ТМЦ", action: "READ", name: "Просмотр ТМЦ", description: "Просмотр остатков материалов, ЗИП и СИЗ" },
  { code: "wms.items.create", module: "wms", moduleName: "WMS Складской учет", section: "items", sectionName: "Реестр ТМЦ", action: "CREATE", name: "Создание номенклатуры ТМЦ", description: "Добавление новых материалов в каталоге" },
  { code: "wms.items.update", module: "wms", moduleName: "WMS Складской учет", section: "items", sectionName: "Реестр ТМЦ", action: "UPDATE", name: "Редактирование ТМЦ", description: "Корректировка пороговых остатков и цен" },
  { code: "wms.movements.execute", module: "wms", moduleName: "WMS Складской учет", section: "movements", sectionName: "Аудит движений ТМЦ", action: "EXECUTE", name: "Проведение движений ТМЦ", description: "Оформление прихода, расхода и корректировок" },
  { code: "wms.personal_cards.manage", module: "wms", moduleName: "WMS Складской учет", section: "personal_cards", sectionName: "Личные карточки СИЗ", action: "EXECUTE", name: "Выдача СИЗ по карточкам", description: "Выдача и возврат СИЗ сотрудникам" },
  { code: "wms.transfers.manage", module: "wms", moduleName: "WMS Складской учет", section: "transfers", sectionName: "Запросы со складов", action: "EXECUTE", name: "Межскладские трансферы", description: "Оформление и утверждение перемещений со складов" },
  { code: "wms.writeoffs.manage", module: "wms", moduleName: "WMS Складской учет", section: "writeoffs", sectionName: "Списание ТМЦ", action: "EXECUTE", name: "Списание ТМЦ", description: "Оформление актов списания непригодных ТМЦ" },
  { code: "wms.topology.manage", module: "wms", moduleName: "WMS Складской учет", section: "topology", sectionName: "Адресный учет", action: "UPDATE", name: "Топология складов", description: "Управление ячейками, зонами и стеллажами" },

  // Admin Module
  { code: "admin.roles.manage", module: "admin", moduleName: "Администрирование & Настройки", section: "rbac", sectionName: "Пользователи и Роли (RBAC)", action: "UPDATE", name: "Управление ролями и RBAC", description: "Доступ к Конструктору ролей и назначению прав" },
  { code: "admin.audit.read", module: "admin", moduleName: "Администрирование & Настройки", section: "audit", sectionName: "Логи аудита", action: "READ", name: "Просмотр аудита", description: "Доступ к системному журналу безопасности" },
  { code: "admin.settings.manage", module: "admin", moduleName: "Администрирование & Настройки", section: "settings", sectionName: "Системные настройки", action: "UPDATE", name: "Системные настройки", description: "Конфигурирование общих параметров EMS" },
];

export function getGroupedPermissions(): PermissionModuleGroup[] {
  const map = new Map<string, PermissionModuleGroup>();

  for (const perm of SYSTEM_PERMISSIONS) {
    if (!map.has(perm.module)) {
      map.set(perm.module, {
        moduleId: perm.module,
        moduleName: perm.moduleName,
        sections: [],
      });
    }

    const group = map.get(perm.module)!;
    let section = group.sections.find((s) => s.sectionId === perm.section);
    if (!section) {
      section = {
        sectionId: perm.section,
        sectionName: perm.sectionName,
        permissions: [],
      };
      group.sections.push(section);
    }

    section.permissions.push(perm);
  }

  return Array.from(map.values());
}
