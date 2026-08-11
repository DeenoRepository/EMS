-- PostgreSQL Migration: SEC-03 Add WMS CHECK constraints for inventory quantities & movements

-- 1. Таблица WmsItem (Остатки, резервы и лимиты не могут быть отрицательными, а резерв не может превышать остаток)
ALTER TABLE "WmsItem"
  ADD CONSTRAINT "chk_wms_item_quantity" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "chk_wms_item_reserved_quantity" CHECK ("reservedQuantity" >= 0),
  ADD CONSTRAINT "chk_wms_item_reserved_le_quantity" CHECK ("reservedQuantity" <= "quantity"),
  ADD CONSTRAINT "chk_wms_item_min_quantity" CHECK ("minQuantity" >= 0),
  ADD CONSTRAINT "chk_wms_item_max_quantity" CHECK ("maxQuantity" >= 0),
  ADD CONSTRAINT "chk_wms_item_unit_price" CHECK ("unitPrice" >= 0);

-- 2. Таблица WmsMovement (Количество складского движения должно быть строго больше нуля)
ALTER TABLE "WmsMovement"
  ADD CONSTRAINT "chk_wms_movement_quantity" CHECK ("quantity" > 0);

-- 3. Таблица WmsReservation (Количество резерва должно быть строго больше нуля)
ALTER TABLE "WmsReservation"
  ADD CONSTRAINT "chk_wms_reservation_quantity" CHECK ("reservedQuantity" > 0);

-- 4. Таблица WmsWriteOff (Количество списания должно быть строго больше нуля)
ALTER TABLE "WmsWriteOff"
  ADD CONSTRAINT "chk_wms_writeoff_quantity" CHECK ("quantity" > 0);

-- 5. Таблица WmsTransferRequest (Количество перемещения должно быть строго больше нуля)
ALTER TABLE "WmsTransferRequest"
  ADD CONSTRAINT "chk_wms_transfer_request_quantity" CHECK ("quantity" > 0);

-- 6. Таблица WmsPersonalCard (Количество спецодежды/СИЗ должно быть строго больше нуля)
ALTER TABLE "WmsPersonalCard"
  ADD CONSTRAINT "chk_wms_personalcard_quantity" CHECK ("issuedQuantity" > 0);
