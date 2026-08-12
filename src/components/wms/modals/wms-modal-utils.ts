import { Warehouse, WmsItem } from "@/types/wms";

export interface TopologySelection {
  warehouse: string;
  zone: string;
  cell: string;
}

export interface StockValidationResult {
  isValid: boolean;
  maxAvailable: number;
  errorMessage?: string;
}

/**
 * Returns available zones for a given warehouse name
 */
export function getZonesForWarehouse(warehouseName: string, warehouses: Warehouse[] = []): string[] {
  const found = warehouses.find((w) => w.name === warehouseName || w.id === warehouseName);
  if (found && found.zones && found.zones.length > 0) {
    return found.zones.map((z: any) => (typeof z === "string" ? z : z.name || z.code || z.id));
  }
  // Default fallbacks for standard WMS zones
  return ["Зона А (Основная)", "Зона B (Стеллажная)", "Зона C (Мезонин)", "Зона D (Приемка/Отгрузка)"];
}

/**
 * Returns available cells for a given zone
 */
export function getCellsForZone(zoneName: string): string[] {
  if (zoneName.includes("А") || zoneName.includes("A")) {
    return ["Яч-A1-01", "Яч-A1-02", "Яч-A2-01", "Яч-A2-02", "Яч-A3-05"];
  }
  if (zoneName.includes("B") || zoneName.includes("Б")) {
    return ["Яч-B1-10", "Яч-B1-11", "Яч-B2-04", "Яч-B3-01"];
  }
  if (zoneName.includes("C")) {
    return ["Яч-C1-01", "Яч-C1-02", "Яч-C2-10"];
  }
  return ["Яч-01", "Яч-02", "Яч-03", "Яч-04", "Яч-05"];
}

/**
 * Calculates current available quantity of an item
 */
export function getAvailableStock(item?: WmsItem | null): number {
  if (!item) return 0;
  const total = typeof item.quantity === "number" ? item.quantity : 0;
  const reserved = typeof item.reservedQuantity === "number" ? item.reservedQuantity : 0;
  return Math.max(0, total - reserved);
}

/**
 * Validates requested quantity against stock availability
 */
export function validateStockLimit(requestedQuantity: number, availableStock: number): StockValidationResult {
  if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
    return {
      isValid: false,
      maxAvailable: availableStock,
      errorMessage: "Количество должно быть больше 0"
    };
  }
  if (requestedQuantity > availableStock) {
    return {
      isValid: false,
      maxAvailable: availableStock,
      errorMessage: `Превышен доступный остаток на складе (${availableStock} шт.)`
    };
  }
  return {
    isValid: true,
    maxAvailable: availableStock
  };
}

/**
 * Placeholder stub for barcode scanner integration
 */
export function scanBarcodeStub(
  scannedCode: string,
  allItems: WmsItem[],
  onMatch: (item: WmsItem) => void,
  onError?: (msg: string) => void
): boolean {
  const cleanCode = scannedCode.trim().toLowerCase();
  if (!cleanCode) return false;

  const found = allItems.find(
    (item) =>
      item.sku?.toLowerCase() === cleanCode ||
      item.barcode?.toLowerCase() === cleanCode ||
      item.id?.toLowerCase() === cleanCode
  );

  if (found) {
    onMatch(found);
    return true;
  } else {
    if (onError) onError(`ТМЦ со штрихкодом "${scannedCode}" не найдено в каталоге`);
    return false;
  }
}

/**
 * Helper to prompt confirmation if form is dirty before closing
 */
export function checkDirtyFormClose(isDirty: boolean, onClose: () => void): void {
  if (!isDirty) {
    onClose();
    return;
  }
  const confirmed = window.confirm("У вас есть несохраненные данные. Вы уверены, что хотите закрыть форму?");
  if (confirmed) {
    onClose();
  }
}
