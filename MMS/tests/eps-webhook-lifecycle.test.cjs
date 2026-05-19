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

test("EPS webhook lifecycle: create/update duplicate stale delete", async () => {
  await ensureServer();

  const unique = Date.now().toString();
  const equipmentId = `it-eps-eq-${unique}`;
  const t0 = new Date();
  const t1 = new Date(t0.getTime() + 60_000);
  const tOld = new Date(t0.getTime() - 60_000);

  try {
    const createRes = await fetch(`${baseUrl}/api/integrations/eps/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: `eps-it-create-${unique}`,
        eventType: "equipment.created",
        timestamp: t0.toISOString(),
        version: 1,
        data: {
          id: equipmentId,
          equipmentCode: "IT-EPS-001",
          name: "IT EPS Equipment",
          status: "ACTIVE",
          lifecycleStage: "IN_OPERATION",
          sourceUpdatedAt: t0.toISOString(),
          version: 1
        }
      })
    });
    assert.equal(createRes.status, 200);

    const created = await prisma.syncedEquipment.findUnique({ where: { id: equipmentId } });
    assert.ok(created);
    assert.equal(created.name, "IT EPS Equipment");
    assert.equal(created.status, "ACTIVE");

    const updateRes = await fetch(`${baseUrl}/api/integrations/eps/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: `eps-it-update-${unique}`,
        eventType: "equipment.updated",
        timestamp: t1.toISOString(),
        version: 2,
        data: {
          id: equipmentId,
          equipmentCode: "IT-EPS-002",
          name: "IT EPS Equipment Updated",
          status: "MAINTENANCE",
          lifecycleStage: "MAINTENANCE",
          sourceUpdatedAt: t1.toISOString(),
          version: 2
        }
      })
    });
    assert.equal(updateRes.status, 200);

    const updated = await prisma.syncedEquipment.findUnique({ where: { id: equipmentId } });
    assert.equal(updated.equipmentCode, "IT-EPS-002");
    assert.equal(updated.name, "IT EPS Equipment Updated");
    assert.equal(updated.status, "MAINTENANCE");

    const duplicateRes = await fetch(`${baseUrl}/api/integrations/eps/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: `eps-it-update-${unique}`,
        eventType: "equipment.updated",
        timestamp: t1.toISOString(),
        version: 2,
        data: {
          id: equipmentId,
          equipmentCode: "IT-EPS-002",
          name: "IT EPS Equipment Updated",
          status: "MAINTENANCE",
          sourceUpdatedAt: t1.toISOString(),
          version: 2
        }
      })
    });
    assert.equal(duplicateRes.status, 200);
    const duplicateBody = await duplicateRes.json();
    assert.equal(duplicateBody.duplicate, true);

    const staleRes = await fetch(`${baseUrl}/api/integrations/eps/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: `eps-it-stale-${unique}`,
        eventType: "equipment.updated",
        timestamp: tOld.toISOString(),
        version: 1,
        data: {
          id: equipmentId,
          equipmentCode: "IT-EPS-OLD",
          name: "OLD NAME",
          status: "ACTIVE",
          sourceUpdatedAt: tOld.toISOString(),
          version: 1
        }
      })
    });
    assert.equal(staleRes.status, 200);
    const staleBody = await staleRes.json();
    assert.equal(staleBody.ignored, true);
    assert.equal(staleBody.reason, "stale_event");

    const afterStale = await prisma.syncedEquipment.findUnique({ where: { id: equipmentId } });
    assert.equal(afterStale.equipmentCode, "IT-EPS-002");
    assert.equal(afterStale.name, "IT EPS Equipment Updated");

    const deleteRes = await fetch(`${baseUrl}/api/integrations/eps/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: `eps-it-delete-${unique}`,
        eventType: "equipment.deleted",
        timestamp: new Date(t1.getTime() + 60_000).toISOString(),
        version: 3,
        data: {
          id: equipmentId,
          sourceUpdatedAt: new Date(t1.getTime() + 60_000).toISOString(),
          version: 3
        }
      })
    });
    assert.equal(deleteRes.status, 200);

    const deleted = await prisma.syncedEquipment.findUnique({ where: { id: equipmentId } });
    assert.equal(deleted, null);
  } finally {
    await prisma.syncedEquipment.deleteMany({ where: { id: equipmentId } });
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

