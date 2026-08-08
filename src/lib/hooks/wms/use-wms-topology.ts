"use client";

import { useState, useEffect, useCallback } from "react";
import { Warehouse, StorageCell } from "@/types/wms";

export function useWmsTopology() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/modules/wms/warehouses");
      const data = res.ok ? await res.json() : { warehouses: [] };
      setWarehouses(data.warehouses || []);
    } catch (err: any) {
      console.error("useWmsTopology fetch error:", err);
      setError(err.message || "Failed to fetch topology data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addWarehouse = async (name: string, location: string, responsibleUser: string) => {
    try {
      const res = await fetch("/api/modules/wms/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location, responsibleUser })
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.error || "Ошибка создания склада" };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Ошибка сети" };
    }
  };

  const addCell = async (warehouseId: string, code: string, description: string, capacity: number) => {
    try {
      const res = await fetch("/api/modules/wms/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId, code, description, capacity })
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.error || "Ошибка добавления ячейки" };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Ошибка сети" };
    }
  };

  return {
    warehouses,
    loading,
    error,
    refetch: fetchData,
    addWarehouse,
    addCell
  };
}
