import { Role } from "@/lib/auth/rbac";
import { MODULES_CONFIG, UISlotConfig } from "@/lib/config/modules";

export interface RegisteredSlotItem extends UISlotConfig {
  moduleId: string;
}

class UISlotRegistryManager {
  private customSlots: RegisteredSlotItem[] = [];

  /**
   * Возвращает все активные UI-слоты для указанного идентификатора слота с фильтрацией по ролям пользователя
   */
  public getSlotItems(slotId: string, userRoles: Role[] = []): RegisteredSlotItem[] {
    const manifestSlots: RegisteredSlotItem[] = [];

    // Собираем слоты, объявленные в манифестах модулей
    Object.values(MODULES_CONFIG).forEach((module) => {
      if (module.status !== "offline" && module.uiSlots) {
        module.uiSlots.forEach((slot) => {
          if (slot.slotId === slotId) {
            manifestSlots.push({
              ...slot,
              moduleId: module.id,
            });
          }
        });
      }
    });

    const allItems = [...manifestSlots, ...this.customSlots.filter((s) => s.slotId === slotId)];

    // Фильтрация по правам доступа
    return allItems
      .filter((item) => {
        if (!item.requiredRoles || item.requiredRoles.length === 0) return true;
        return item.requiredRoles.some((role) => userRoles.includes(role));
      })
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  /**
   * Динамическая регистрация слота во время работы приложения (для гидратации расширений)
   */
  public registerSlot(slot: RegisteredSlotItem): void {
    const exists = this.customSlots.some(
      (s) => s.moduleId === slot.moduleId && s.slotId === slot.slotId && s.componentId === slot.componentId
    );
    if (!exists) {
      this.customSlots.push(slot);
    }
  }
}

export const UISlotRegistry = new UISlotRegistryManager();
