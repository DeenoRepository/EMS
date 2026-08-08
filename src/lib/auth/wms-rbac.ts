import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

/**
 * Проверяет, привязан ли пользователь как МОЛ к конкретному складу.
 * Если да — возвращает названия складов, за которые он отвечает.
 * Если пользователь ADMIN — возвращает null (нет ограничений, доступ ко всем складам).
 */
export async function getUserResponsibleWarehouses(): Promise<string[] | null> {
  const session = await getSession();
  
  if (!session) return []; // Если нет сессии — нет доступа
  if (session.roles.includes("ADMIN")) return null; // ADMIN видит все склады

  const userWarehouses = await prisma.warehouse.findMany({
    where: {
      OR: [
        { responsibleUser: { equals: session.displayName, mode: "insensitive" } },
        { responsibleUser: { equals: session.username, mode: "insensitive" } },
        { responsibleUsername: { equals: session.username, mode: "insensitive" } }
      ]
    },
    select: { name: true }
  });

  if (userWarehouses.length === 0) {
    // Если пользователь не числится МОЛ ни за одним складом напрямую, возвращаем null для обратной совместимости,
    // либо доступ ко всем складам для рядовых операторов.
    return null;
  }

  return userWarehouses.map((w) => w.name);
}
