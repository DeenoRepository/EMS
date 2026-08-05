export interface ModuleManifest {
  code: string; // e.g. "EPS", "MRO", "SRM", "WMS"
  name: string;
  description: string;
  version: string;
  entryPoint: string;
  iconName: string;
  requiredRoles: string[];
  healthCheckUrl: string;
  status: "active" | "degraded" | "offline";
}

export const REGISTERED_MODULES: ModuleManifest[] = [
  {
    code: "EPS",
    name: "EPS Паспортизация",
    description: "Паспорта и учет промышленного оборудования",
    version: "1.16.0",
    entryPoint: "/modules/eps",
    iconName: "Cpu",
    requiredRoles: ["VIEWER", "EDITOR", "APPROVER", "ADMIN"],
    healthCheckUrl: "/api/modules/eps/health",
    status: "active"
  },
  {
    code: "MRO",
    name: "MRO (ТОИР)",
    description: "Техническое обслуживание и ремонты",
    version: "0.9.0-dev",
    entryPoint: "/modules/mro",
    iconName: "Wrench",
    requiredRoles: ["EDITOR", "ADMIN"],
    healthCheckUrl: "/api/modules/mro/health",
    status: "degraded"
  },
  {
    code: "SRM",
    name: "SRM Заявки",
    description: "Управление сервисными заявками",
    version: "1.0.0",
    entryPoint: "/modules/srm",
    iconName: "FileCheck",
    requiredRoles: ["EDITOR", "ADMIN"],
    healthCheckUrl: "/api/modules/srm/health",
    status: "active"
  },
  {
    code: "WMS",
    name: "WMS Склад",
    description: "Учет материалов и складские запасы",
    version: "1.0.0",
    entryPoint: "/modules/wms",
    iconName: "Warehouse",
    requiredRoles: ["ADMIN"],
    healthCheckUrl: "/api/modules/wms/health",
    status: "active"
  }
];

export function getRegisteredModules(): ModuleManifest[] {
  return REGISTERED_MODULES;
}

export function getModuleByCode(code: string): ModuleManifest | undefined {
  return REGISTERED_MODULES.find((m) => m.code.toUpperCase() === code.toUpperCase());
}
