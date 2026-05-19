"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";

const viewerAllowedRoutes = ["/dashboard", "/ppr-plans", "/operations", "/analytics", "/failures"];

function isAllowedForViewer(pathname: string) {
  return viewerAllowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, error, isForbidden } = useCurrentUser();

  if (loading) {
    return <LoadingState text="Проверка доступа..." />;
  }

  if (isForbidden) {
    return <ErrorState text="Доступ запрещен для текущей учетной записи" />;
  }

  if (error || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6">
        <ErrorState text="Не удалось определить пользователя" onRetry={() => window.location.reload()} />
        <Link href="/login">
          <Button>Перейти ко входу</Button>
        </Link>
      </div>
    );
  }

  const isViewerOnly = user.roles.includes("VIEWER") && !user.roles.some((role) => ["EDITOR", "APPROVER", "ADMIN"].includes(role));
  if (isViewerOnly && !isAllowedForViewer(pathname)) {
    return <ErrorState text="Для роли VIEWER доступны разделы: панель, планы ППР, операции, отказы и RCA, аналитика." />;
  }

  return <>{children}</>;
}
