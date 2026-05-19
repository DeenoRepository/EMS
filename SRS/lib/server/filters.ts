import { NextRequest } from "next/server";

export function buildIssueFilters(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const status = req.nextUrl.searchParams.get("status");
  const responsible = req.nextUrl.searchParams.get("responsible");
  const subdivision = req.nextUrl.searchParams.get("subdivision");
  const equipment = req.nextUrl.searchParams.get("equipment");
  const inProgress = req.nextUrl.searchParams.get("inProgress");

  const where: any = {};
  if (type) where.type = { equals: type, mode: "insensitive" };
  if (status) where.status = { equals: status, mode: "insensitive" };
  if (responsible) where.responsible = { contains: responsible, mode: "insensitive" };
  if (inProgress === "1") where.isInProgress = true;

  if (subdivision || equipment) {
    where.equipment = {};
    if (subdivision) where.equipment.subdivision = { contains: subdivision, mode: "insensitive" };
    if (equipment) {
      where.equipment.OR = [
        { uid: { contains: equipment, mode: "insensitive" } },
        { title: { contains: equipment, mode: "insensitive" } }
      ];
    }
  }

  return where;
}
