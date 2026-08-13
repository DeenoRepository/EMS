import crypto from "crypto";
import { Role } from "./rbac";
import { setWithTTL, get, del } from "@/lib/db/redis";

export interface ApiKeyConfig {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  roles: Role[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

const API_KEY_PREFIX = "apikey:";
const API_KEY_TTL = 30 * 24 * 60 * 60; // 30 дней

/**
 * Хэширует API-ключ перед сохранением
 */
function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Создаёт новый сервисный API-ключ
 */
export async function createApiKey(name: string, roles: Role[]): Promise<{ apiKey: string; record: ApiKeyConfig }> {
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
    createdAt: new Date().toISOString(),
  };

  await setWithTTL(`${API_KEY_PREFIX}${record.id}`, JSON.stringify(record), API_KEY_TTL);

  return { apiKey, record };
}

/**
 * Проверяет подлинность переданного API-ключа
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyConfig | null> {
  if (!apiKey || !apiKey.startsWith("ems_live_")) return null;

  const inputHash = hashKey(apiKey);

  // В реальной реализации нужен индекс по keyHash для быстрого поиска
  // Для простоты используем сканирование (в production — использовать Redis SET с хэшами)
  const { getRedis } = await import("@/lib/db/redis");
  const redis = getRedis();

  if (redis) {
    // Используем Redis SET для быстрого поиска по хэшу
    const hashIndexKey = `${API_KEY_PREFIX}hash:${inputHash}`;
    const keyId = await get(hashIndexKey);

    if (keyId) {
      const keyData = await get(`${API_KEY_PREFIX}${keyId}`);
      if (keyData) {
        try {
          const record = JSON.parse(keyData) as ApiKeyConfig;
          if (record.isActive) {
            record.lastUsedAt = new Date().toISOString();
            await setWithTTL(`${API_KEY_PREFIX}${record.id}`, JSON.stringify(record), API_KEY_TTL);
            return record;
          }
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Удаляет API-ключ
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  await del(`${API_KEY_PREFIX}${keyId}`);
}
