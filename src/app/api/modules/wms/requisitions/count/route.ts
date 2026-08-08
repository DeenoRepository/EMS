import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const count = await prisma.wmsRequisition.count({
      where: { status: "REQUESTED" }
    });
    return NextResponse.json({ count });
  } catch (err) {
    console.error("Failed to count pending WMS requisitions:", err);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
