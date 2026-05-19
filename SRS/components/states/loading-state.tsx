import { Card } from "@/components/ui/card";

export function LoadingState({ text = "Загрузка...", title = "Подготовка данных" }: { text?: string; title?: string }) {
  return (
    <Card className="flex items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </Card>
  );
}
