"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, User, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginUser = customUser ?? username;
    const loginPass = customPass ?? password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Ошибка сервера (${res.status})`);
        return;
      }

      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сети при попытке авторизации");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleLogin(undefined, u, p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-lg">
            EMS
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Корпоративный Вход</h1>
          <p className="text-xs text-muted-foreground">
            Единая авторизация внутреннего контура enterprise-системы
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-md space-y-5">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-foreground">
                Имя пользователя (LDAP / Login)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2 mt-2" disabled={loading}>
              <Shield className="h-4 w-4" aria-hidden="true" />
              {loading ? "Авторизация…" : "Войти в платформу"}
            </Button>
          </form>

          {/* Quick Mock Login Profiles */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Быстрый вход (Mock профили):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs justify-start"
                onClick={() => quickLogin("admin", "admin123")}
              >
                <Badge className="bg-purple-500/10 text-purple-600 border-0 mr-1 text-[10px]">ADMIN</Badge>
                admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs justify-start"
                onClick={() => quickLogin("editor", "editor123")}
              >
                <Badge className="bg-blue-500/10 text-blue-600 border-0 mr-1 text-[10px]">EDITOR</Badge>
                editor
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs justify-start"
                onClick={() => quickLogin("approver", "approver123")}
              >
                <Badge className="bg-amber-500/10 text-amber-600 border-0 mr-1 text-[10px]">APPROVER</Badge>
                approver
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs justify-start"
                onClick={() => quickLogin("storekeeper", "storekeeper123")}
              >
                <Badge className="bg-amber-500/10 text-amber-700 border-0 mr-1 text-[10px]">WMS</Badge>
                storekeeper
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs justify-start"
                onClick={() => quickLogin("viewer", "viewer123")}
              >
                <Badge className="bg-emerald-500/10 text-emerald-600 border-0 mr-1 text-[10px]">VIEWER</Badge>
                viewer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
