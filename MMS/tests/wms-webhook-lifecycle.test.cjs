const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const prisma = new PrismaClient();
const baseUrl = process.env.MMS_TEST_BASE_URL || "http://localhost:3000";
let managedDevProcess = null;

async function isServerUp() {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    return res.status >= 200 && res.status < 600;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureServer() {
  if (await isServerUp()) return;

  managedDevProcess = spawn("npm.cmd", ["run", "dev"], {
    cwd: process.cwd(),
    shell: true,
    stdio: "ignore",
    windowsHide: true
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isServerUp()) return;
    await sleep(1500);
  }
  throw new Error("MMS server did not start on time");
}

test("WMS webhook lifecycle: issued, duplicate, stale, completed", async () => {
  await ensureServer();

  const unique = Date.now().toString();
  const equipmentId = `it-eq-${unique}`;
  const externalReservationId = `it-wms-res-${unique}`;
  const eventIssued = `it-wms-evt-issued-${unique}`;
  const eventStale = `it-wms-evt-stale-${unique}`;
  const eventCompleted = `it-wms-evt-completed-${unique}`;

  const workOrder = await prisma.workOrder.create({
    data: {
      equipmentId,
      title: `IT WorkOrder ${unique}`,
      priority: "HIGH",
      status: "APPROVED",
      externalWmsId: externalReservationId
    }
  });

  const reservation = await prisma.warehouseReservation.create({
    data: {
      equipmentId,
      externalId: externalReservationId,
      status: "RESERVED",
      requiredItems: [{ sku: "22090131", quantity: 1 }],
      response: { seed: true }
    }
  });

  const task = await prisma.pprTask.create({
    data: {
      equipmentId,
      scheduledDate: new Date(),
      maintenanceType: "PREVENTIVE",
      status: "PLANNED",
      warehouseReservationId: reservation.id
    }
  });

  try {
    const issuedRes = await fetch(`${baseUrl}/api/integrations/wms/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId: externalReservationId,
        status: "ISSUED",
        eventId: eventIssued,
        timestamp: new Date().toISOString()
      })
    });
    assert.equal(issuedRes.status, 200);
    const issuedBody = await issuedRes.json();
    assert.equal(issuedBody.ok, true);
    assert.equal(issuedBody.status, "ISSUED");

    const afterIssuedTask = await prisma.pprTask.findUnique({ where: { id: task.id } });
    const afterIssuedOrder = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
    assert.equal(afterIssuedTask.status, "IN_PROGRESS");
    assert.equal(afterIssuedOrder.status, "IN_PROGRESS");

    const duplicateRes = await fetch(`${baseUrl}/api/integrations/wms/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId: externalReservationId,
        status: "ISSUED",
        eventId: eventIssued,
        timestamp: new Date().toISOString()
      })
    });
    assert.equal(duplicateRes.status, 200);
    const duplicateBody = await duplicateRes.json();
    assert.equal(duplicateBody.duplicate, true);

    const staleRes = await fetch(`${baseUrl}/api/integrations/wms/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId: externalReservationId,
        status: "REQUESTED",
        eventId: eventStale,
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      })
    });
    assert.equal(staleRes.status, 200);
    const staleBody = await staleRes.json();
    assert.equal(staleBody.ignored, true);
    assert.equal(staleBody.reason, "stale_status");

    const completedAt = new Date().toISOString();
    const completedRes = await fetch(`${baseUrl}/api/integrations/wms/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId: externalReservationId,
        status: "ISSUED",
        workCompleted: true,
        completedAt,
        eventId: eventCompleted,
        timestamp: completedAt
      })
    });
    assert.equal(completedRes.status, 200);
    const completedBody = await completedRes.json();
    assert.equal(completedBody.ok, true);

    const afterCompletedTask = await prisma.pprTask.findUnique({ where: { id: task.id } });
    const afterCompletedOrder = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
    assert.equal(afterCompletedTask.status, "COMPLETED");
    assert.equal(afterCompletedOrder.status, "COMPLETED");
    assert.ok(afterCompletedOrder.actualEndAt);
  } finally {
    await prisma.pprTask.deleteMany({ where: { id: task.id } });
    await prisma.warehouseReservation.deleteMany({ where: { id: reservation.id } });
    await prisma.workOrder.deleteMany({ where: { id: workOrder.id } });
  }
});

test.after(async () => {
  if (managedDevProcess && managedDevProcess.pid) {
    try {
      process.kill(managedDevProcess.pid, "SIGTERM");
    } catch {}
  }
  await prisma.$disconnect();
});
