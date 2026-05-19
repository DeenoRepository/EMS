# WMS E2E Checklist

Date: 2026-04-29
Environment: Docker (`ems-wms-app`)

## ADMIN
- [ ] Login and open `/wms`
- [ ] Open `/wms/admin`, assign responsible emails
- [ ] Create/modify warehouse
- [ ] Create/modify stock item
- [ ] Open movements, execute `RECEIPT`
- [ ] Verify balances updated

## AUXILIARY responsible
- [ ] Login and confirm доступ only to: dashboard/balances/movements/internal-requests
- [ ] Create internal request in `/wms/internal-requests`
- [ ] Verify request visible in list with correct status

## CENTRAL responsible
- [ ] Login and confirm доступ to: dashboard/balances/movements/reservations/analytics/internal-requests
- [ ] Reserve internal request
- [ ] Fulfill internal request
- [ ] Verify issue movement created

## Reservations flow
- [ ] Create reservation for MMS WO/part
- [ ] Issue reservation
- [ ] Verify stock reduced and reservation status `ISSUED`
- [ ] If MMS unavailable, response contains `mms_sync_warning`

## Analytics and monitoring
- [ ] Open `/wms/analytics` and validate KPI blocks
- [ ] Check `/api/wms/integrations/mms/sync-status`
- [ ] Check `/api/wms/internal-requests/sla?targetHours=24`

## Notes
- Fill this checklist per release candidate and archive results with timestamp.
