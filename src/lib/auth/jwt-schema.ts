import { z } from "zod";

export const roleKeyEnum = z.enum([
  "ADMIN",
  "EDITOR",
  "APPROVER",
  "VIEWER",
  "STOREKEEPER",
]);

export const jwtPayloadSchema = z.object({
  id: z.string().min(1, "ID пользователя не может быть пустым"),
  username: z.string().min(1, "Имя пользователя обязательно"),
  displayName: z.string().default("Пользователь"),
  email: z.string().email("Некорректный форматированный адрес e-mail"),
  roles: z.array(roleKeyEnum).min(1, "Должна быть назначена хотя бы одна роль"),
  jti: z.string().min(1, "Уникальный идентификатор токена (jti) обязателен"),
  iss: z.literal("ems-auth-service"),
  aud: z.literal("ems-app"),
});

export type ValidatedJwtPayload = z.infer<typeof jwtPayloadSchema>;
