"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/client/notify";

export function ApprovalDecisionButtons({ approvalId }: { approvalId: string }) {
  const [isPending, startTransition] = useTransition();

  const sendDecision = (status: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/approvals/${approvalId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        });
        if (!res.ok) {
          notifyError("Не удалось сохранить решение");
          return;
        }
        notifySuccess(status === "APPROVED" ? "Заявка согласована" : "Заявка отклонена");
        window.location.reload();
      } catch {
        notifyError("Сетевая ошибка при сохранении решения");
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={isPending} onClick={() => sendDecision("APPROVED")}>Согласовать</Button>
      <Button size="sm" variant="destructive" disabled={isPending} onClick={() => sendDecision("REJECTED")}>Отклонить</Button>
    </div>
  );
}
