import { UISlotConfig, MODULES_CONFIG } from "@/lib/config/modules";
import { Role, UserSession, hasRole } from "@/lib/auth/rbac";

export interface RegisteredSlotComponent {
  id: string;
  slotId: string;
  moduleId: string;
  title: string;
  order: number;
  requiredRoles?: Role[];
  renderKey: string;
}

const registeredSlots: RegisteredSlotComponent[] = [];

// Автоматическая инициализация слотов из манифестов модулей
Object.values(MODULES_CONFIG).forEach((module) => {
  if (module.uiSlots) {
    module.uiSlots.forEach((slot: UISlotConfig) => {
      registeredSlots.push({
        id: `${module.id}_${slot.componentId}`,
        slotId: slot.slotId,
        moduleId: module.id,
        title: slot.title,
        order: slot.order || 10,
        requiredRoles: slot.requiredRoles,
        renderKey: slot.componentId
      });
    });
  }
});

/**
 * Получает доступные слоты для конкретной точки в интерфейсе с учетом прав пользователя
 */
export function getSlotComponents(slotId: string, user: UserSession | null): RegisteredSlotComponent[] {
  return registeredSlots
    .filter((slot) => slot.slotId === slotId)
    .filter((slot) => {
      if (!slot.requiredRoles || slot.requiredRoles.length === 0) return true;
      return hasRole(user, slot.requiredRoles);
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Позволяет новому модулю динамически зарегистрировать свой UI-слот
 */
export function registerUiSlot(slot: RegisteredSlotComponent): void {
  const exists = registeredSlots.some((s) => s.id === slot.id);
  if (!exists) {
    registeredSlots.push(slot);
  }
}
