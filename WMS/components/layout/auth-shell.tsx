"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { useWmsScope } from "@/lib/client/use-wms-scope";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";

function allowedByScope(access: "ADMIN" | "CENTRAL" | "AUXILIARY" | "NONE", pathname: string) {
  const exact = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  if (access === "ADMIN") return true;
  if (access === "NONE") return exact("/wms");
  if (exact("/wms") || exact("/wms/balances") || exact("/wms/movements")) return true;
  if (access === "AUXILIARY" && exact("/wms/internal-requests")) return true;
  if (access === "CENTRAL" && (exact("/wms/reservations") || exact("/wms/analytics") || exact("/wms/internal-requests") || exact("/wms/audit"))) return true;
  return false;
}

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, error, isForbidden } = useCurrentUser();
  const { scope, loading: scopeLoading } = useWmsScope();

  if (loading || scopeLoading) return <LoadingState text="Проверка доступа..." />;
  if (isForbidden) return <ErrorState text="Доступ запрещен для текущей учетной записи" />;

  if (error || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6">
        <ErrorState text="Не удалось определить пользователя" onRetry={() => window.location.reload()} />
        <Link href="/login"><Button>Перейти ко входу</Button></Link>
      </div>
    );
  }

  if (scope && !allowedByScope(scope.access, pathname)) {
    return <ErrorState text={scope.access === "NONE" ? "Для вашей учетной записи не назначен ответственный склад." : "Недостаточно прав для данного раздела."} />;
  }

  return <>{children}</>;
}
