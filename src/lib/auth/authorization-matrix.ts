import { Role } from "./rbac";

export interface EndpointPolicy {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  allowedRoles: Role[];
  description: string;
}

/**
 * Декларативная матрица прав доступа ролей к API-эндпоинтам (SEC-09)
 * Принцип: Deny-by-default (все операции по умолчанию требуют авторизации и явного разрешения роли)
 */
export const AUTHORIZATION_MATRIX: EndpointPolicy[] = [
  // Справочники (Reference)
  {
    path: "/api/reference/fields",
    method: "GET",
    allowedRoles: ["ADMIN", "EDITOR", "APPROVER", "STOREKEEPER", "VIEWER"],
    description: "Просмотр справочных полей",
  },
  {
    path: "/api/reference/fields",
    method: "POST",
    allowedRoles: ["ADMIN", "EDITOR"],
    description: "Создание/изменение справочных полей",
  },
  {
    path: "/api/reference/values",
    method: "POST",
    allowedRoles: ["ADMIN", "EDITOR"],
    description: "Создание/изменение справочных значений",
  },
  {
    path: "/api/reference/options",
    method: "POST",
    allowedRoles: ["ADMIN", "EDITOR"],
    description: "Управление справочными опциями",
  },

  // Атрибуты типов оборудования
  {
    path: "/api/equipment-type-attributes",
    method: "GET",
    allowedRoles: ["ADMIN", "EDITOR", "APPROVER", "STOREKEEPER", "VIEWER"],
    description: "Просмотр динамических атрибутов оборудования",
  },
  {
    path: "/api/equipment-type-attributes",
    method: "POST",
    allowedRoles: ["ADMIN", "EDITOR"],
    description: "Создание/изменение динамических атрибутов типов",
  },

  // Административные эндпоинты
  {
    path: "/api/admin/warehouses",
    method: "POST",
    allowedRoles: ["ADMIN"],
    description: "Управление складами",
  },
  {
    path: "/api/admin/facilities",
    method: "POST",
    allowedRoles: ["ADMIN"],
    description: "Управление объектами обустройства",
  },
  {
    path: "/api/admin/audit",
    method: "GET",
    allowedRoles: ["ADMIN"],
    description: "Просмотр логов аудита",
  },
];
