import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ErrorState({
  text = "Не удалось загрузить данные",
  title = "Ошибка загрузки",
  onRetry,
  retryLabel = "Повторить"
}: {
  text?: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Card className="space-y-4 p-8 text-center">
      <p className="text-base font-semibold text-status-error">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      {onRetry ? <Button variant="outline" onClick={onRetry}>{retryLabel}</Button> : null}
    </Card>
  );
}
