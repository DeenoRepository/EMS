"use client";

import { useState, useEffect, useCallback } from "react";
import { WmsPersonalCard, WmsEmployee, WmsItem } from "@/types/wms";

export function useWmsPersonalCards() {
  const [cards, setCards] = useState<WmsPersonalCard[]>([]);
  const [employees, setEmployees] = useState<WmsEmployee[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, empRes, itemsRes] = await Promise.all([
        fetch("/api/modules/wms/personal-cards"),
        fetch("/api/modules/wms/employees"),
        fetch("/api/modules/wms/items")
      ]);

      const cardsData = cardsRes.ok ? await cardsRes.json() : { cards: [] };
      const empData = empRes.ok ? await empRes.json() : { employees: [] };
      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };

      setCards(cardsData.cards || []);
      setEmployees(empData.employees || []);
      setItems(itemsData.items || []);
    } catch (err: any) {
      console.error("useWmsPersonalCards fetch error:", err);
      setError(err.message || "Failed to fetch personal cards data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const returnItem = async (cardId: string, returnCondition: string = "GOOD") => {
    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId, returnCondition })
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.error || "Ошибка возврата СИЗ/инструмента" };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Ошибка сети" };
    }
  };

  return {
    cards,
    employees,
    items,
    loading,
    error,
    refetch: fetchData,
    returnItem
  };
}
