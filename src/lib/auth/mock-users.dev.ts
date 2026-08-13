/**
 * MOCK_USERS — ТОЛЬКО ДЛЯ РАЗРАБОТКИ И ТЕСТИРОВАНИЯ (SEC-02)
 *
 * ⚠️  ВНИМАНИЕ: Этот файл содержит тестовых пользователей с захардкоженными паролями.
 *    Он НЕ ДОЛЖЕН использоваться в production.
 *
 * В production build этот модуль возвращает пустой объект благодаря проверке NODE_ENV.
 * Дополнительная защита — в src/lib/config/env.ts (ENABLE_MOCK_AUTH).
 */
import { UserSession } from "./rbac";

export const MOCK_USERS: Record<string, UserSession & { _devPassword: string }> = {};

// SEC-02: MOCK_USERS доступны только в development/test
if (process.env.NODE_ENV !== "production" && process.env.ENABLE_MOCK_AUTH !== "false") {
    Object.assign(MOCK_USERS, {
        admin: {
            id: "usr-admin",
            username: "admin",
            displayName: "Администратор EMS",
            email: "admin@ems.local",
            roles: ["ADMIN"],
            permissions: ["*"],
            _devPassword: "admin123"
        },
        storekeeper: {
            id: "usr-storekeeper",
            username: "storekeeper",
            displayName: "Сидоров И.К. (Кладовщик WMS)",
            email: "storekeeper@ems.local",
            roles: ["wms_storekeeper"],
            permissions: [
                "wms.items.read", "wms.items.create", "wms.items.update",
                "wms.movements.execute", "wms.personal_cards.manage",
                "wms.transfers.manage", "wms.writeoffs.manage", "wms.topology.manage",
                "eps.equipment.read"
            ],
            _devPassword: "storekeeper123"
        },
        editor: {
            id: "usr-editor",
            username: "editor",
            displayName: "Инженер Редактор",
            email: "editor@ems.local",
            roles: ["eps_engineer"],
            permissions: [
                "eps.equipment.read", "eps.equipment.create", "eps.equipment.update",
                "eps.documents.manage", "eps.reports.export", "wms.items.read"
            ],
            _devPassword: "editor123"
        },
        approver: {
            id: "usr-approver",
            username: "approver",
            displayName: "Руководитель Согласующий",
            email: "approver@ems.local",
            roles: ["eps_approver"],
            permissions: [
                "eps.equipment.read", "eps.approvals.decide", "eps.reports.export",
                "wms.items.read", "wms.transfers.manage"
            ],
            _devPassword: "approver123"
        },
        viewer: {
            id: "usr-viewer",
            username: "viewer",
            displayName: "Наблюдатель Оборудования",
            email: "viewer@ems.local",
            roles: ["viewer_readonly"],
            permissions: ["eps.equipment.read", "wms.items.read"],
            _devPassword: "viewer123"
        }
    });
}
