"use client";

import { useState, useEffect, useCallback } from "react";
import { WmsMovement, WmsItem, Warehouse, EquipmentOption } from "@/types/wms";

export function useWmsMovements() {
  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [movRes, whRes, itemsRes, eqRes] = await Promise.all([
        fetch("/api/modules/wms/movements"),
        fetch("/api/modules/wms/warehouses"),
        fetch("/api/modules/wms/items"),
        fetch("/api/modules/eps/equipment")
      ]);

      const movData = movRes.ok ? await movRes.json() : { movements: [] };
      const whData = whRes.ok ? await whRes.json() : { warehouses: [] };
      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };
      const eqData = eqRes.ok ? await eqRes.json() : { equipment: [] };

      setMovements(movData.movements || []);
      setWarehouses(whData.warehouses || []);
      setItems(itemsData.items || []);
      setEquipments(
        (eqData.equipment || []).map((e: any) => ({
          id: e.id,
          equipmentCode: e.equipmentCode,
          name: e.name
        }))
      );
    } catch (err: any) {
      console.error("useWmsMovements fetch error:", err);
      setError(err.message || "Failed to fetch movements data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    movements,
    warehouses,
    items,
    equipments,
    loading,
    error,
    refetch: fetchData
  };
}
