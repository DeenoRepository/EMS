import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(1, "Email или логин обязателен"),
  password: z.string().min(1, "Пароль обязателен")
});

export const jiraSettingsSchema = z.object({
  apiUrl: z.string().url("Неверный URL"),
  username: z.string().min(1, "Имя пользователя обязательно"),
  token: z.string().min(1, "Токен обязателен"),
  jql: z.string().optional(),
  autoImportEnabled: z.boolean().default(false),
  autoImportPeriodMinutes: z.number().int().positive().optional(),
  filterIds: z.array(z.string()).default([])
});

export const heatmapSettingsSchema = z.object({
  mode: z.enum(["FAILURES", "DOWNTIME"]),
  minValue: z.number().int().default(0),
  maxValue: z.number().int().default(10)
});

export const importFilterSchema = z.object({
  equipmentTitle: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
});

export const reportParamsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  equipmentIds: z.array(z.string()).optional(),
  blocks: z.array(z.enum(["dashboard", "downtime", "employee"])).default(["dashboard"])
});
