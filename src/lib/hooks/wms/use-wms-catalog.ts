"use client";

import { useState, useEffect, useCallback } from "react";
import { WmsItem, Warehouse, WmsRequisition, EquipmentOption } from "@/types/wms";

export function useWmsCatalog(searchQuery: string = "") {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [requisitions, setRequisitions] = useState<WmsRequisition[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, whRes, reqsRes, eqRes] = await Promise.all([
        fetch(`/api/modules/wms/items?query=${encodeURIComponent(searchQuery)}`),
        fetch("/api/modules/wms/warehouses"),
        fetch("/api/modules/wms/requisitions"),
        fetch("/api/modules/eps/equipment")
      ]);

      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };
      const whData = whRes.ok ? await whRes.json() : { warehouses: [] };
      const reqsData = reqsRes.ok ? await reqsRes.json() : { requisitions: [] };
      const eqData = eqRes.ok ? await eqRes.json() : { equipment: [] };

      setItems(itemsData.items || []);
      setWarehouses(whData.warehouses || []);
      setRequisitions(reqsData.requisitions || []);
      setEquipments(
        (eqData.equipment || []).map((e: any) => ({
          id: e.id,
          equipmentCode: e.equipmentCode,
          name: e.name
        }))
      );
    } catch (err: any) {
      console.error("useWmsCatalog fetch error:", err);
      setError(err.message || "Failed to fetch catalog data");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    items,
    warehouses,
    requisitions,
    equipments,
    loading,
    error,
    refetch: fetchData
  };
}
