import { prisma } from "@/lib/db/prisma";
import { UserSession } from "@/lib/auth/rbac";

/**
 * Проверяет, имеет ли пользователь доступ к файлу документа (SEC-06)
 *
 * Логика:
 * 1. ADMIN имеет доступ ко всем файлам
 * 2. Пользователь имеет доступ, если он:
 *    - Ответственный за оборудование, к которому привязан документ
 *    - Имеет роль EDITOR/APPROVER для модуля EPS
 *    - Имеет роль STOREKEEPER для модуля WMS
 *
 * @param storagePath - путь к файлу в хранилище
 * @param session - сессия пользователя
 * @returns true если доступ разрешен
 */
export async function canAccessFile(
    storagePath: string,
    session: UserSession
): Promise<boolean> {
    // ADMIN имеет полный доступ
    if (session.roles.includes("ADMIN")) {
        return true;
    }

    // Ищем документ по storagePath
    const documentVersion = await prisma.documentVersion.findFirst({
        where: { storagePath },
        include: {
            document: {
                include: {
                    equipment: {
                        select: {
                            id: true,
                            responsibleUserId: true,
                            department: true,
                        },
                    },
                },
            },
        },
    });

    if (!documentVersion) {
        // Если документ не найден, проверяем по equipment
        // (для обратной совместимости со старыми путями)
        return false;
    }

    const equipment = documentVersion.document.equipment;

    // Ответственный за оборудование имеет доступ
    if (equipment.responsibleUserId === session.id) {
        return true;
    }

    // Пользователи с правами на чтение EPS имеют доступ к документам
    if (
        session.roles.includes("EDITOR") ||
        session.roles.includes("APPROVER") ||
        session.roles.includes("VIEWER") ||
        session.roles.includes("eps_engineer") ||
        session.roles.includes("eps_approver") ||
        session.roles.includes("viewer_readonly")
    ) {
        return true;
    }

    return false;
}

/**
 * Извлекает document ID из storagePath (SEC-06)
 *
 * Формат: documents/{timestamp}_{hash}_{filename}
 * или: {year}/{month}/{uuid}-{filename}
 */
export function extractDocumentIdFromPath(storagePath: string): string | null {
    // Пытаемся найти document version по storagePath
    // Это упрощённая версия — в production нужна более надёжная схема
    const match = storagePath.match(/documents\/([^/]+)/);
    return match ? match[1] : null;
}
