import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { parseXmlEvents } from "@/lib/srs/xml-parser";
import { issueSourceHash } from "@/lib/srs/dedupe";
const allowedStatuses = new Set(["resolved", "done", "closed", "in progress", "решено", "закрыто", "в процессе", "в работе"]);
export async function POST(req: NextRequest) {
  const session = await requireAnyRole(["ADMIN", "EDITOR"]);
  const contentType = req.headers.get("content-type") ?? "";
  let xml = "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    xml = body.xml ?? "";
  } else {
    xml = await req.text();
  }
  if (!xml.trim()) return NextResponse.json({ error: "xml payload is empty" }, { status: 400 });
  const run = await prisma.importRun.create({
    data: { sourceType: "XML", status: "RUNNING", initiatedBy: session.email }
  });
  try {
    const parsed = parseXmlEvents(xml).filter((x) => allowedStatuses.has(x.status.toLowerCase()));
    let loaded = 0;
    await prisma.$transaction(async (tx) => {
      for (const event of parsed) {
        const equipment = await tx.equipment.upsert({
          where: { uid: event.equipmentUid },
          update: { title: event.equipmentTitle, inventoryNumber: event.inventoryNumber, subdivision: event.subdivision },
          create: { uid: event.equipmentUid, title: event.equipmentTitle, inventoryNumber: event.inventoryNumber, subdivision: event.subdivision }
        });
        const sourceHash = issueSourceHash({
          jiraIssueKey: event.jiraIssueKey,
          equipmentUid: event.equipmentUid,
          startAt: event.startAt.toISOString(),
          type: event.type,
          responsible: event.responsible,
          description: event.description
        });
        const exists = await tx.issue.findUnique({ where: { sourceHash } });
        if (exists) continue;
        await tx.issue.create({
          data: {
            equipmentId: equipment.id,
            jiraIssueKey: event.jiraIssueKey,
            startAt: event.startAt,
            endAt: event.endAt,
            type: event.type,
            status: event.status,
            responsible: event.responsible,
            reporter: event.reporter,
            description: event.description,
            comments: event.comments,
            isInProgress: event.isInProgress,
            source: "XML",
            sourceHash
          }
        });
        loaded += 1;
      }
      await tx.importRun.update({
        where: { id: run.id },
        data: { status: "SUCCESS", itemsTotal: parsed.length, itemsLoaded: loaded, finishedAt: new Date() }
      });
    });
    return NextResponse.json({ importRunId: run.id.toString(), itemsTotal: parsed.length, itemsLoaded: loaded });
  } catch (e) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorText: e instanceof Error ? e.message : "unknown error" }
    });
    return NextResponse.json({ error: e instanceof Error ? e.message : "xml import failed" }, { status: 500 });
  }
}
