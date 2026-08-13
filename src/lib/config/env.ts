/**
 * Валидация переменных окружения (SEC-12)
 *
 * Все критичные env переменные валидируются при старте приложения.
 * Приложение не запустится с невалидными или отсутствующими переменными.
 *
 * Использование:
 *   import { env } from "@/lib/config/env";
 *   const secret = env.JWT_SECRET;
 */
import { z } from "zod";

/**
 * Схема валидации переменных окружения
 */
const envSchema = z.object({
    // Окружение
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // JWT (SEC-01, SEC-10)
    JWT_SECRET: z
        .string()
        .min(32, "JWT_SECRET должен содержать минимум 32 символа для безопасности")
        .describe("Секрет для подписи JWT токенов (минимум 32 символа)"),

    // Service Token (SEC-01)
    SERVICE_JWT_SECRET: z
        .string()
        .min(32, "SERVICE_JWT_SECRET должен содержать минимум 32 символа")
        .describe("Секрет для межмодульных service-to-service токенов"),

    // Database
    DATABASE_URL: z
        .string()
        .url("DATABASE_URL должен быть валидным URL")
        .describe("URL подключения к PostgreSQL"),

    // Storage (S3/MinIO)
    S3_ENDPOINT: z.string().url().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),

    // LDAP (SEC-11)
    LDAP_URL: z.string().url().optional(),
    LDAP_BASE_DN: z.string().optional(),
    LDAP_BIND_DN: z.string().optional(),
    LDAP_BIND_PASSWORD: z.string().optional(),
    LDAP_DOMAIN: z.string().optional(),
    LDAP_MOCK_SUCCESS: z.enum(["true", "false"]).default("false"),
    LDAP_USER_SEARCH_FILTER: z.string().optional(),
    LDAP_GROUP_SEARCH_BASE: z.string().optional(),
    LDAP_GROUP_SEARCH_FILTER: z.string().optional(),
    LDAP_GROUP_ROLE_MAPPING: z.string().optional(),

    // Redis (SEC-03)
    REDIS_URL: z.string().url().optional(),
    REDIS_PASSWORD: z.string().optional(),

    // CORS (SEC-16)
    CORS_ALLOWED_ORIGINS: z.string().optional(),

    // Security
    COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
    ENABLE_MOCK_AUTH: z.enum(["true", "false"]).default("false"),

    // Monitoring
    SENTRY_DSN: z.string().url().optional(),

    // Application
    NEXT_PUBLIC_APP_VERSION: z.string().optional(),
});

/**
 * Типизированные env переменные
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Парсинг и валидация env переменных
 *
 * В production — fail-fast при любой ошибке валидации.
 * В development — более мягкая валидация с предупреждениями.
 */
function parseEnv(): Env {
    const isProduction = process.env.NODE_ENV === "production";

    try {
        const parsed = envSchema.parse(process.env);

        // Дополнительные проверки для production
        if (isProduction) {
            // SEC-01: В production запрещены дефолтные/тестовые секреты
            const forbiddenSecrets = [
                "ems-dev-jwt-secret-key-for-local-development-only-32bytes",
                "ems-inter-module-service-token-secret-2026",
                "change-me",
                "changeme",
                "secret",
                "test",
            ];

            if (forbiddenSecrets.some((s) => parsed.JWT_SECRET.toLowerCase().includes(s))) {
                throw new Error(
                    "CRITICAL SECURITY ERROR: JWT_SECRET содержит запрещённое значение. " +
                    "Используйте криптографически стойкий случайный ключ."
                );
            }

            if (forbiddenSecrets.some((s) => parsed.SERVICE_JWT_SECRET.toLowerCase().includes(s))) {
                throw new Error(
                    "CRITICAL SECURITY ERROR: SERVICE_JWT_SECRET содержит запрещённое значение. " +
                    "Используйте криптографически стойкий случайный ключ."
                );
            }

            // SEC-02: В production запрещён MOCK_AUTH
            if (parsed.ENABLE_MOCK_AUTH === "true") {
                throw new Error(
                    "CRITICAL SECURITY ERROR: ENABLE_MOCK_AUTH=true запрещён в production. " +
                    "Используйте реальную аутентификацию через БД или LDAP."
                );
            }

            // SEC-11: В production запрещён LDAP_MOCK_SUCCESS
            if (parsed.LDAP_MOCK_SUCCESS === "true") {
                throw new Error(
                    "CRITICAL SECURITY ERROR: LDAP_MOCK_SUCCESS=true запрещён в production. " +
                    "Используйте реальный LDAP/AD сервер."
                );
            }

            // SEC-10: В production cookie должны быть secure
            if (parsed.COOKIE_SECURE !== "true") {
                console.warn(
                    "⚠️  SECURITY WARNING: COOKIE_SECURE=false в production. " +
                    "Cookie будут передаваться по HTTP. Установите COOKIE_SECURE=true."
                );
            }
        }

        return parsed;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue: z.ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`)
                .join("\n");

            const message = `❌ Ошибка валидации переменных окружения:\n${issues}\n\n` +
                `Проверьте файл .env и убедитесь, что все обязательные переменные установлены.\n` +
                `См. .env.example для справки.`;

            if (isProduction) {
                throw new Error(message);
            } else {
                console.error(message);
                // В development возвращаем process.env как есть для удобства разработки
                return process.env as unknown as Env;
            }
        }

        throw error;
    }
}

/**
 * Валидированные env переменные
 *
 * ⚠️  Не импортируйте process.env напрямую в коде.
 *    Всегда используйте этот объект для доступа к env переменным.
 */
export const env = parseEnv();

/**
 * Проверка, что приложение запущено в production
 */
export const isProduction = env.NODE_ENV === "production";

/**
 * Проверка, что приложение запущено в development
 */
export const isDevelopment = env.NODE_ENV === "development";

/**
 * Проверка, что приложение запущено в test
 */
export const isTest = env.NODE_ENV === "test";
