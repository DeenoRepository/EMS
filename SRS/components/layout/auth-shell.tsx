"use client";

import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AuthShell({ children }: { children: ReactNode }) {
  const { user, loading, error } = useCurrentUser();

  if (loading) {
    return <LoadingState text="Проверка доступа..." />;
  }

  if (error || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6">
        <ErrorState text="Не удалось определить пользователя" onRetry={() => window.location.reload()} />
        <Link href="/login"><Button>Перейти ко входу</Button></Link>
      </div>
    );
  }

  return <>{children}</>;
}
