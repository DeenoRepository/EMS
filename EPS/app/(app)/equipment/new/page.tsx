"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default function CreateEquipmentPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/equipment">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <Breadcrumbs items={[{ label: "Оборудование", href: "/equipment" }, { label: "Создание" }]} />
        </div>
      </div>
      <EquipmentForm mode="create" />
    </div>
  );
}
