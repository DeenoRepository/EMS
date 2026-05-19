"use client";

import { useEffect, useState } from "react";

export type ClientWmsScope = {
  access: "ADMIN" | "CENTRAL" | "AUXILIARY" | "NONE";
  responsibleWarehouseIds: string[];
  centralWarehouseId: string | null;
};

export function useWmsScope() {
  const [scope, setScope] = useState<ClientWmsScope | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/wms/me/scope", { cache: "no-store" });
        if (!res.ok) {
          setScope({ access: "NONE", responsibleWarehouseIds: [], centralWarehouseId: null });
          return;
        }
        setScope(await res.json());
      } catch {
        setScope({ access: "NONE", responsibleWarehouseIds: [], centralWarehouseId: null });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return { scope, loading };
}
