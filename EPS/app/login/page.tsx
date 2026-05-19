"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/client/notify";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authProvider = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || "ldap").toUpperCase();
  const isPasswordRequired = authProvider === "LDAP";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        notifyError(data.error || "Ошибка входа");
        return;
      }
      notifySuccess("Авторизация выполнена");
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Сетевая ошибка";
      setError(message || "Сетевая ошибка");
      notifyError(message || "Сетевая ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.08),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(15,23,42,0.08),transparent_40%)]" />
      <Card className="relative w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Защищённый вход
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Авторизация</h1>
          <p className="text-sm text-slate-500">Введите корпоративные учетные данные для доступа в систему паспортизации.</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-sm font-medium text-slate-700">Логин или email</label>
            <Input
              className="mt-1 h-11"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="ivanov@enterprise.local"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Пароль</label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                className="h-11 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-status-error">{error}</p> : null}

          <Button type="submit" className="h-11 w-full" disabled={loading || !login.trim() || (isPasswordRequired && !password.trim())}>
            {loading ? "Проверка учетных данных..." : "Войти в систему"}
          </Button>
        </form>

        <p className="text-xs text-slate-500">Провайдер авторизации: {authProvider}</p>
      </Card>
    </div>
  );
}
