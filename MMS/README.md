# DEPS TOIR Module

## Equipment Flow
1. Equipment is synchronized from EPS into local TOIR registry (`SyncedEquipment`).
2. After synchronization, an individual PPR plan is automatically created for each new equipment unit.
3. Initial PPR tasks are generated from that individual plan (based on interval/horizon settings).
4. Manual TOIR operations can be created only for equipment existing in local TOIR registry.

## Automatic Sync
- Auto-sync runs on access to `GET /api/integrations/eps/synced-equipment`.
- Sync starts only when stale (by interval), not on every request.
- Controls via env:
  - `AUTO_SYNC_EQUIPMENT=true|false`
  - `AUTO_SYNC_INTERVAL_MINUTES=30`
  - `EPS_SYNC_PAGE_SIZE=100`
  - `EPS_SYNC_MAX_PAGES=200`
  - `DEFAULT_PPR_INTERVAL_DAYS=90`
  - `DEFAULT_PPR_HORIZON_MONTHS=12`
  - `DEFAULT_PPR_MAINTENANCE_TYPE=PREVENTIVE`

## Main API
- `POST /api/integrations/eps/sync` - force sync from EPS + auto-create individual plans
- `GET /api/integrations/eps/synced-equipment` - local registry search/pagination (and auto-sync check)
- `POST /api/maintenance/plans/generate-from-registry` - bulk generation by registry filters
- `GET/POST /api/maintenance/plans`
- `GET/PATCH /api/maintenance/plans/:id`
- `POST /api/maintenance/plans/:id/generate`
- `GET/POST /api/maintenance/tasks`
- `PATCH /api/maintenance/tasks/:id`
- `PATCH /api/maintenance/tasks/bulk` (bulk status/date updates)
- `GET/POST /api/failures`
- `GET/PATCH /api/failures/:id`
- `PATCH /api/failures/bulk`
- `GET /api/analytics/ppr/summary`
- `GET /api/analytics/failures/summary`

## UX Layer (Enterprise Style)
- Unified top navigation and contextual page title.
- KPI cards on every main page.
- Status color coding for plans/tasks/RCA/severity.
- Search + filters + pagination in list screens.
- Quick actions to sync equipment and generate plans.
- Dedicated Failures & RCA page for reliability workflow.

## Run Full Stack (EPS + TOIR)
```powershell
cd C:\Users\Deeno\Documents\Projects\MMS\TOIR
docker compose -f docker-compose.full.yml up -d --build
docker compose -f docker-compose.full.yml ps
```

URLs:
- EPS: `http://localhost:3100`
- TOIR: `http://localhost:3001`

Stop:
```powershell
docker compose -f docker-compose.full.yml down
```
