"use client";

import { useState, useEffect, useCallback } from "react";
import { WmsRequisition, Warehouse, WmsItem } from "@/types/wms";

export function useWmsRequisitions() {
  const [requisitions, setRequisitions] = useState<WmsRequisition[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, whRes, itemsRes] = await Promise.all([
        fetch("/api/modules/wms/requisitions"),
        fetch("/api/modules/wms/warehouses"),
        fetch("/api/modules/wms/items")
      ]);

      const reqData = reqRes.ok ? await reqRes.json() : { requisitions: [] };
      const whData = whRes.ok ? await whRes.json() : { warehouses: [] };
      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };

      setRequisitions(reqData.requisitions || []);
      setWarehouses(whData.warehouses || []);
      setItems(itemsData.items || []);
    } catch (err: any) {
      console.error("useWmsRequisitions fetch error:", err);
      setError(err.message || "Failed to fetch requisitions data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateRequisitionStatus = async (
    id: string,
    newStatus: "APPROVED" | "REJECTED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"
  ) => {
    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus })
      });

      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.error || "Ошибка смены статуса" };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Ошибка сети" };
    }
  };

  return {
    requisitions,
    warehouses,
    items,
    loading,
    error,
    refetch: fetchData,
    updateRequisitionStatus
  };
}
