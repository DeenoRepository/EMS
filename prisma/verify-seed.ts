import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const [items, eq, wh, mv, emp, pc, wr, rs, roles, users, reqs, transfers] = await Promise.all([
    p.wmsItem.count(),
    p.equipment.count(),
    p.warehouse.count(),
    p.wmsMovement.count(),
    p.wmsEmployee.count(),
    p.wmsPersonalCard.count(),
    p.wmsWriteOff.count(),
    p.wmsReservation.count(),
    p.role.count(),
    p.user.count(),
    p.wmsRequisition.count(),
    p.wmsTransferRequest.count(),
  ]);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✅ ВЕРИФИКАЦИЯ SEED ДАННЫХ В POSTGRESQL:");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  EPS:`);
  console.log(`    Роли:              ${roles}`);
  console.log(`    Пользователи:      ${users}`);
  console.log(`    Оборудование:      ${eq}`);
  console.log(`  WMS:`);
  console.log(`    Склады:            ${wh}`);
  console.log(`    Номенклатура ТМЦ:  ${items}`);
  console.log(`    Движения:          ${mv}`);
  console.log(`    Сотрудники:        ${emp}`);
  console.log(`    Личные карточки:   ${pc}`);
  console.log(`    Акты списания:     ${wr}`);
  console.log(`    Резервы:           ${rs}`);
  console.log(`    Заявки-Requisition:${reqs}`);
  console.log(`    Перемещения:       ${transfers}`);
  console.log("═══════════════════════════════════════════════════\n");

  // Sample WMS Items
  const wmsItems = await p.wmsItem.findMany({ select: { sku: true, name: true, quantity: true, warehouse: true, status: true } });
  console.log("  Номенклатурный каталог ТМЦ:");
  for (const i of wmsItems) {
    console.log(`    [${i.status}] ${i.sku} — ${i.name} (кол-во: ${i.quantity}, склад: ${i.warehouse})`);
  }

  // Sample Equipment
  const equipment = await p.equipment.findMany({ select: { equipmentCode: true, name: true, status: true, department: true } });
  console.log("\n  Реестр оборудования EPS:");
  for (const e of equipment) {
    console.log(`    [${e.status}] ${e.equipmentCode} — ${e.name} (${e.department})`);
  }

  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
