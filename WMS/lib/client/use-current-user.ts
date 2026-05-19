"use client";

import { useEffect, useState } from "react";
import type { ClientUser } from "@/lib/client/auth";

export function useCurrentUser() {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) {
          setError(res.status === 403 ? "forbidden" : "failed");
          setUser(null);
          return;
        }
        const data: ClientUser = await res.json();
        setUser(data);
      } catch {
        setError("failed");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return { user, loading, error, isForbidden: error === "forbidden" };
}
