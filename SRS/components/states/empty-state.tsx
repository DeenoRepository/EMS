import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmptyState({
  text,
  title = "Данные не найдены",
  actionLabel,
  onAction
}: {
  text: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="p-10 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
