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
  wms: {
    id: "wms",
    name: "WMS Складской учет",
    href: "/modules/wms",
    version: `v${APP_VERSION}`,
    status: "online",
    description: "Управление складами, ячейками хранения, остатками ТМЦ и списанием",
  },
};

