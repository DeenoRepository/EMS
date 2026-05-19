# WMS Runbook

## Roles and Access
- `ADMIN`: full access to all pages and APIs.
- `CENTRAL responsible`: `/wms`, `/wms/balances`, `/wms/movements`, `/wms/reservations`, `/wms/analytics`, `/wms/internal-requests`.
- `AUXILIARY responsible`: `/wms`, `/wms/balances`, `/wms/movements`, `/wms/internal-requests`.

## Assign responsibilities
1. Open `/wms/admin`.
2. Set `responsibleEmail` for each warehouse.
3. Save.

## Internal request flow
1. Auxiliary creates request at `/wms/internal-requests`.
2. Central reserves lines (`RESERVED`) via `POST /api/wms/internal-requests/:id/reserve`.
3. Central fulfills request via `POST /api/wms/internal-requests/:id/fulfill`.
4. Deficit lines are processed on the same page `/wms/internal-requests`.

## Smoke scenarios
1. Login as `ADMIN`, open `/wms/admin`, assign `responsibleEmail` to central and auxiliary warehouses.
2. Login as auxiliary responsible, create internal request in `/wms/internal-requests`.
3. Login as central responsible, reserve and fulfill the request.
4. Check stock movement in `/wms/movements` and balances in `/wms/balances`.
5. Verify SLA and policy KPIs in `/wms/analytics`.

## SLA and reports
- SLA: `/api/wms/internal-requests/sla?targetHours=24`
- Requests efficiency: `/api/wms/reports/requests-efficiency`
- Policy metrics: `/api/wms/reports/policy-metrics`
- Audit log: `/api/wms/audit`
- MMS sync status: `/api/wms/integrations/mms/sync-status`

## Reliability settings
- `MMS_TIMEOUT_MS` (default `5000`)
- `MMS_RETRIES` (default `2`)
- `MMS_RETRY_DELAY_MS` (default `300`)

## Release discipline
- Freeze policy: `docs/WMS_FREEZE_POLICY.md`
- E2E checklist: `docs/WMS_E2E_CHECKLIST.md`

## Restart
```powershell
docker compose restart wms-app
```
