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
  }
];

export function getRegisteredModules(): ModuleManifest[] {
  return REGISTERED_MODULES;
}

export function getModuleByCode(code: string): ModuleManifest | undefined {
  return REGISTERED_MODULES.find((m) => m.code.toUpperCase() === code.toUpperCase());
}
