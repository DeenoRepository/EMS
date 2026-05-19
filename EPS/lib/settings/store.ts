import { promises as fs } from "fs";
import path from "path";

export type ProjectSettings = {
  general: {
    companyName: string;
    siteName: string;
    timezone: string;
    locale: string;
  };
  workflow: {
    equipmentChangesRequireApproval: boolean;
    documentChangesRequireApproval: boolean;
    rollbackEnabledForApprover: boolean;
    enforceAuditTrail: boolean;
  };
  documents: {
    requiredByEquipmentType: Record<string, string[]>;
  };
  ui: {
    defaultPageSize: number;
    dateFormat: string;
    desktopFirst: boolean;
  };
  storage: {
    localMode: "UPLOADS" | "NETWORK_DRIVE";
    networkDiskPath: string;
  };
  integrations: {
    ldapEnabled: boolean;
    ldapUrl: string;
    ldapBaseDn: string;
    ldapUserBaseDn: string;
    ldapGroupBaseDn: string;
  };
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
const settingsPath = path.join(dataDir, "project-settings.json");

const defaultSettings: ProjectSettings = {
  general: {
    companyName: "DEPS Enterprise",
    siteName: "Equipment Passport",
    timezone: process.env.TZ || "Asia/Novosibirsk",
    locale: "ru-RU"
  },
  workflow: {
    equipmentChangesRequireApproval: true,
    documentChangesRequireApproval: true,
    rollbackEnabledForApprover: true,
    enforceAuditTrail: true
  },
  documents: {
    requiredByEquipmentType: {
      DEFAULT: ["PASSPORT", "OPERATION_MANUAL"],
      COMPRESSOR: ["PASSPORT", "CERTIFICATE", "ACT"],
      PRESS: ["PASSPORT", "OPERATION_MANUAL", "CERTIFICATE"]
    }
  },
  ui: {
    defaultPageSize: 20,
    dateFormat: "YYYY-MM-DD",
    desktopFirst: true
  },
  storage: {
    localMode: "UPLOADS",
    networkDiskPath: process.env.NETWORK_STORAGE_PATH || "\\\\fileserver\\deps-docs"
  },
  integrations: {
    ldapEnabled: (process.env.AUTH_PROVIDER || "mock") === "ldap",
    ldapUrl: process.env.LDAP_URL || "ldap://127.0.0.1:3890",
    ldapBaseDn: process.env.LDAP_BASE_DN || "dc=enterprise,dc=local",
    ldapUserBaseDn: process.env.LDAP_USER_BASE_DN || "ou=people,dc=enterprise,dc=local",
    ldapGroupBaseDn: process.env.LDAP_GROUP_BASE_DN || "ou=groups,dc=enterprise,dc=local"
  }
};

function mergeWithDefaults(raw?: Partial<ProjectSettings>): ProjectSettings {
  return {
    general: { ...defaultSettings.general, ...(raw?.general || {}) },
    workflow: { ...defaultSettings.workflow, ...(raw?.workflow || {}) },
    documents: {
      requiredByEquipmentType: {
        ...defaultSettings.documents.requiredByEquipmentType,
        ...(raw?.documents?.requiredByEquipmentType || {})
      }
    },
    ui: { ...defaultSettings.ui, ...(raw?.ui || {}) },
    storage: { ...defaultSettings.storage, ...(raw?.storage || {}) },
    integrations: { ...defaultSettings.integrations, ...(raw?.integrations || {}) }
  };
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function normalizeRequiredDocsMap(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => {
    if (!Array.isArray(value)) {
      return [key, []] as const;
    }
    const normalized = value.map((item) => String(item)).filter(Boolean);
    return [key, normalized] as const;
  });

  return Object.fromEntries(entries);
}

export async function readProjectSettings(): Promise<ProjectSettings> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(content) as Partial<ProjectSettings>;
    return mergeWithDefaults(parsed);
  } catch {
    return defaultSettings;
  }
}

export async function writeProjectSettings(patch: DeepPartial<ProjectSettings>) {
  const current = await readProjectSettings();
  const next = mergeWithDefaults({
    ...current,
    ...patch,
    general: { ...current.general, ...(patch.general || {}) },
    workflow: { ...current.workflow, ...(patch.workflow || {}) },
    documents: {
      requiredByEquipmentType: {
        ...current.documents.requiredByEquipmentType,
        ...normalizeRequiredDocsMap(patch.documents?.requiredByEquipmentType)
      }
    },
    ui: { ...current.ui, ...(patch.ui || {}) },
    storage: { ...current.storage, ...(patch.storage || {}) },
    integrations: { ...current.integrations, ...(patch.integrations || {}) }
  });

  await ensureDataDir();
  await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}
