import { APP_VERSION } from "@/lib/version";

export interface ModuleConfig {
  id: string;
  name: string;
  href: string;
  version: string;
  status: "online" | "dev" | "offline";
  description: string;
}

export const MODULES_CONFIG: Record<string, ModuleConfig> = {
  eps: {
    id: "eps",
    name: "EPS Паспортизация",
    href: "/modules/eps",
    version: `v${APP_VERSION}`,
    status: "online",
    description: "Управление паспортами оборудования и структурой иерархии",
  },
  mro: {
    id: "mro",
    name: "MRO (ТОиР)",
    href: "/modules/mro",
    version: `v${APP_VERSION}`,
    status: "dev",
    description: "Техническое обслуживание и ремонт оборудования",
  },
  srm: {
    id: "srm",
    name: "SRM Завод",
    href: "/modules/srm",
    version: `v${APP_VERSION}`,
    status: "dev",
    description: "Управление взаимоотношениями с поставщиками и закупками",
  },
  wms: {
    id: "wms",
    name: "WMS Склад",
    href: "/modules/wms",
    version: `v${APP_VERSION}`,
    status: "online",
    description: "Управление складскими запасами и ЗИП",
  },
};
