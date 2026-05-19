import { EventType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

type EventItem = {
  id: string;
  eventType: EventType;
  title: string;
  description: string | null;
  createdAt: Date;
  actor: { displayName: string } | null;
};

export function EquipmentTimeline({ items }: { items: EventItem[] }) {
  return (
    <ol className="relative ml-3 border-l border-border">
      {items.map((item) => (
        <li key={item.id} className="mb-6 ml-6">
          <span className="absolute -left-2 mt-1 h-3 w-3 rounded-full border bg-primary" />
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge className="bg-secondary text-secondary-foreground">{item.eventType}</Badge>
              <span className="text-xs text-muted-foreground">{item.createdAt.toLocaleString()}</span>
            </div>
            <p className="font-medium">{item.title}</p>
            {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">By: {item.actor?.displayName || "System"}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
