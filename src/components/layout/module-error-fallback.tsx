"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ModuleErrorFallbackProps {
  moduleName: string;
  moduleCode: string;
  errorMessage?: string;
  onRetry?: () => void;
}

export function ModuleErrorFallback({
  moduleName,
  moduleCode,
  errorMessage = "Не удалось установить соединение с сервисом модуля",
  onRetry
}: ModuleErrorFallbackProps) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-6 sm:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Модуль временно недоступен ({moduleName})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Graceful Degradation Engine: Shell продолжает работу в штатном режиме.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-xs border-amber-300 text-amber-700 dark:text-amber-400">
          {moduleCode} OFF
        </Badge>
      </div>

      <div className="rounded-lg border border-border/80 bg-card p-4 text-xs font-mono text-muted-foreground space-y-1">
        <p className="text-destructive font-semibold">Причина:</p>
        <p>{errorMessage}</p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">
          Остальные сервисы и Shell подсистемы функционируют нормально.
        </span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Повторить попытку
          </Button>
        )}
      </div>
    </div>
  );
}
