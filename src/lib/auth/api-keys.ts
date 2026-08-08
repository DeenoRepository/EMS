import crypto from "crypto";
import { Role } from "./rbac";

export interface ApiKeyConfig {
  id: string;
  name: string;
  keyHash: string;
  prefix: string; // Напр. "ems_live_..."
  roles: Role[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

const activeApiKeys: ApiKeyConfig[] = [];

/**
 * Хэширует API-ключ перед сохранением
 */
function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Создаёт новый сервисный API-ключ
 */
export function createApiKey(name: string, roles: Role[]): { apiKey: string; record: ApiKeyConfig } {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const prefix = "ems_live";
  const apiKey = `${prefix}_${randomBytes}`;
  const keyHash = hashKey(apiKey);

  const record: ApiKeyConfig = {
    id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    keyHash,
    prefix: `${prefix}_${randomBytes.substring(0, 6)}...`,
    roles,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  activeApiKeys.push(record);

  return { apiKey, record };
}

/**
 * Проверяет подлинность переданного API-ключа в заголовке Authorization: Bearer <key> или X-API-Key
 */
export function validateApiKey(apiKey: string): ApiKeyConfig | null {
  if (!apiKey || !apiKey.startsWith("ems_live_")) return null;

  const inputHash = hashKey(apiKey);
  const found = activeApiKeys.find((k) => k.isActive && k.keyHash === inputHash);

  if (found) {
    found.lastUsedAt = new Date().toISOString();
    return found;
  }

  return null;
}
