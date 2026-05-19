import Link from "next/link";
import { EquipmentStatus } from "@prisma/client";
import { EquipmentStatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EquipmentRow = {
  id: string;
  equipmentCode: string;
  name: string;
  model: string;
  status: EquipmentStatus;
  location: string | null;
  updatedAt: Date;
};

export function EquipmentTable({ items }: { items: EquipmentRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/equipment/${item.id}`} className="font-medium text-primary hover:underline">
                {item.equipmentCode}
              </Link>
            </TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.model}</TableCell>
            <TableCell>
              <EquipmentStatusBadge status={item.status} />
            </TableCell>
            <TableCell>{item.location || "-"}</TableCell>
            <TableCell>{item.updatedAt.toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
