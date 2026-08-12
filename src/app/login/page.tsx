"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, User, AlertCircle, Info } from "lucide-react";

const IS_DEV = process.env.NODE_ENV === "development";

interface MockProfile {
  username: string;
  password: string;
  role: string;
  roleColor: string;
}

const MOCK_PROFILES: MockProfile[] = [
  { username: "admin", password: "admin123", role: "ADMIN", roleColor: "bg-purple-500/10 text-purple-600" },
  { username: "editor", password: "editor123", role: "EDITOR", roleColor: "bg-blue-500/10 text-blue-600" },
  { username: "approver", password: "approver123", role: "APPROVER", roleColor: "bg-amber-500/10 text-amber-600" },
  { username: "storekeeper", password: "storekeeper123", role: "WMS", roleColor: "bg-amber-500/10 text-amber-700" },
  { username: "viewer", password: "viewer123", role: "VIEWER", roleColor: "bg-emerald-500/10 text-emerald-600" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginUser = customUser ?? username;
    const loginPass = customPass ?? password;

    if (!loginUser.trim() || !loginPass.trim()) {
      setError("Введите имя пользователя и пароль");
      setLoading(false);
      return;
    }

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
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>

      <main id="main-content" className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg">
            EMS
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Корпоративный Вход
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Единая авторизация внутреннего контура enterprise-системы
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg space-y-5">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <FormField label="Имя пользователя (LDAP / Login)" required>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введите имя пользователя"
                required
              />
            </FormField>

            <FormField label="Пароль" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
              />
            </FormField>

            <Button
              type="submit"
              className="w-full gap-2 mt-2"
              disabled={loading}
              size="lg"
            >
              <Shield className="h-4 w-4" aria-hidden="true" />
              {loading ? "Авторизация…" : "Войти в платформу"}
            </Button>
          </form>

          {IS_DEV && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Быстрый вход (только dev-режим)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MOCK_PROFILES.map((profile) => (
                  <Button
                    key={profile.username}
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start"
                    onClick={() => quickLogin(profile.username, profile.password)}
                  >
                    <Badge className={`${profile.roleColor} border-0 mr-2 text-[10px]`}>
                      {profile.role}
                    </Badge>
                    {profile.username}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Забыли пароль? Обратитесь к администратору системы
        </p>
      </main>
    </div>
  );
}
