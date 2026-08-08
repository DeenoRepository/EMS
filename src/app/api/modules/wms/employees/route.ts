import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

// GET /api/modules/wms/employees — Fetch employee roster
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const department = searchParams.get("department");

  try {
    const where: any = { isActive: true };
    if (department && department !== "ALL") {
      where.department = department;
    }
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { employeeNumber: { contains: query, mode: "insensitive" } },
        { position: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } }
      ];
    }

    const employees = await prisma.wmsEmployee.findMany({
      where,
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ employees, total: employees.length });
  } catch (err) {
    console.error("WMS Employees GET failed:", err);
    return NextResponse.json({ employees: [], total: 0 });
  }
}

// POST /api/modules/wms/employees — Register employee to warehouse roster
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    if (!session.roles.includes("ADMIN") && !session.roles.includes("EDITOR")) {
      return NextResponse.json(
        { error: "Отказано в доступе. Регистрация сотрудников доступна только редакторам и администраторам." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, employeeNumber, position, department, warehouse } = body;

    if (!name || !employeeNumber) {
      return NextResponse.json(
        { error: "Поля ФИО и Табельный номер обязательны" },
        { status: 400 }
      );
    }

    // Check existing by employeeNumber
    const existing = await prisma.wmsEmployee.findUnique({
      where: { employeeNumber }
    });

    if (existing) {
      // Update existing employee
      const updated = await prisma.wmsEmployee.update({
        where: { id: existing.id },
        data: {
          name,
          position: position || existing.position,
          department: department || existing.department,
          warehouse: warehouse || existing.warehouse,
          isActive: true
        }
      });
      return NextResponse.json({ employee: updated, updated: true }, { status: 200 });
    }

    const employee = await prisma.wmsEmployee.create({
      data: {
        name,
        employeeNumber,
        position: position || "Сотрудник",
        department: department || "Основное производство",
        warehouse: warehouse || "Главный склад",
        isActive: true
      }
    });

    return NextResponse.json({ employee, created: true }, { status: 201 });
  } catch (err: any) {
    console.error("WMS Employees POST failed:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Сотрудник с таким табельным номером уже существует" }, { status: 400 });
    }
    return NextResponse.json({ error: "Ошибка при добавлении сотрудника в реестр" }, { status: 500 });
  }
}
