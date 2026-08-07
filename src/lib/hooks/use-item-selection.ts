import { useState, useCallback } from "react";

export function useItemSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === items.length && items.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  }, [items, selectedIds.length]);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isAllSelected: selectedIds.length === items.length && items.length > 0,
    hasSelection: selectedIds.length > 0,
  };
}
