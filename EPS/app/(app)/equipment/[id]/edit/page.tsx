"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type EquipmentDetails = {
  id: string;
  name: string;
  type?: string | null;
  category?: string | null;
  model: string;
  serialNumber?: string | null;
  inventoryNumber?: string | null;
  manufacturer?: string | null;
  supplier?: string | null;
  productionDate?: string | null;
  deliveryDate?: string | null;
  commissioningDate?: string | null;
  department?: string | null;
  location?: string | null;
  responsibleUserId?: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  lifecycleStage: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
  warrantyExpiration?: string | null;
  serviceDueDate?: string | null;
  notes?: string | null;
  customAttributes?: Record<string, string> | null;
};

export default function EditEquipmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<EquipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(`/equipment/${params.id}`);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/equipment/${params.id}`);
      if (!res.ok) {
        setError("Не удалось загрузить оборудование");
        setLoading(false);
        return;
      }
      const data: EquipmentDetails = await res.json();
      setItem(data);
      setLoading(false);
    };
    void load();
  }, [params.id]);

  if (loading) return <LoadingState text="Загрузка оборудования..." />;
  if (error || !item) return <ErrorState text={error || "Оборудование не найдено"} />;

  const normalizedCustomAttributes = Object.entries((item.customAttributes || {}) as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      acc[key] = value == null ? "" : String(value);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={goBack} title="Назад">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <Breadcrumbs items={[{ label: "Оборудование", href: "/equipment" }, { label: item.name, href: `/equipment/${params.id}` }, { label: "Редактирование" }]} />
        </div>
      </div>
      <EquipmentForm
        mode="edit"
        equipmentId={params.id}
        initialData={{
          name: item.name,
          type: item.type || "",
          category: item.category || "",
          model: item.model,
          serialNumber: item.serialNumber || "",
          inventoryNumber: item.inventoryNumber || "",
          manufacturer: item.manufacturer || "",
          supplier: item.supplier || "",
          productionDate: item.productionDate?.slice(0, 10) || "",
          deliveryDate: item.deliveryDate?.slice(0, 10) || "",
          commissioningDate: item.commissioningDate?.slice(0, 10) || "",
          department: item.department || "",
          location: item.location || "",
          responsibleUserId: item.responsibleUserId || "",
          status: item.status,
          lifecycleStage: item.lifecycleStage,
          warrantyExpiration: item.warrantyExpiration?.slice(0, 10) || "",
          serviceDueDate: item.serviceDueDate?.slice(0, 10) || "",
          notes: item.notes || "",
          changeSummary: "",
          customAttributes: normalizedCustomAttributes
        }}
      />
    </div>
  );
}
