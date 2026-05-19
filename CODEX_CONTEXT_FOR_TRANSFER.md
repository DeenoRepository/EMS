# EMS Context For Codex (Transfer Package)

## 1. Project overview
- Root: `C:\Users\Deeno\Documents\Projects\EMS`
- Modules:
  - `EPS` - equipment passports
  - `MMS` - maintenance and repair
  - `WMS` - warehouse management
  - `SRS` - analytics, reports, import (DEA Web)
- Infra for local run:
  - 4x PostgreSQL containers (EPS/MMS/WMS/SRS)
  - 1x OpenLDAP container

## 2. Current local orchestration
- Main scripts are in `scripts/`:
  - `ems-up.ps1` - full start
  - `ems-down.ps1` - stop stack
  - `ems-clean.ps1` - clean artifacts
  - `ems-preflight.ps1` - pre-start checks
  - `ems-health.ps1` - health check endpoints
  - `ems-ldap-seed.ps1` - LDAP users/groups seed
  - `ems-db-backup.ps1` - DB backups
  - `ems-db-restore.ps1` - DB restore
- Infra compose:
  - `scripts/docker-compose.infra.yml`

## 3. Auth mode
- All modules are configured to run with LDAP auth in `ems-up.ps1`.
- Mock auth is not used in startup flow.
- LDAP service bind is used:
  - `LDAP_DIRECT_BIND=false`
  - `LDAP_BIND_DN=cn=admin,dc=ems,dc=local`

## 4. LDAP test users (seeded automatically)
- `admin / admin123` -> `DEPS_Admins`
- `editor / editor123` -> `DEPS_Editors`
- `viewer / viewer123` -> `DEPS_Viewers`
- LDAP admin bind:
  - DN: `cn=admin,dc=ems,dc=local`
  - password default: `admin` (or from `.env.ems.local`)

## 5. Environment and secrets
- Use `.env.ems.local.example` as template.
- Create local file:
  - `.env.ems.local`
- Recommended variables:
  - `EMS_LDAP_ADMIN_PASSWORD`
  - `EMS_LDAP_USER_ADMIN_PASSWORD`
  - `EMS_LDAP_USER_EDITOR_PASSWORD`
  - `EMS_LDAP_USER_VIEWER_PASSWORD`

## 6. Migrations / Prisma specifics
- EPS and WMS have `prisma/migrations` and use `prisma migrate deploy`.
- MMS currently has no `prisma/migrations` directory in this snapshot.
  - startup script falls back to `prisma db push` for MMS only.
- WMS migration chain includes reconciliation migration:
  - `20260430080000_reconcile_schema_gap`

## 7. Known operational notes
- On Windows, `node_modules` DLL locks can cause `EPERM`.
  - `ems-up.ps1` includes retry for Prisma generate/migrate.
- Script forces Node path and uses explicit npm cmd path if available:
  - `C:\Program Files\nodejs\npm.cmd`

## 8. Transfer runbook (new PC)
1. Install prerequisites:
   - Node.js LTS (with PATH)
   - Docker Desktop
2. Copy `EMS` folder.
3. In root:
   - copy `.env.ems.local.example` to `.env.ems.local`
4. Run:
   - `npm run preflight`
   - `npm run up`
   - `npm run health`
5. Open:
   - EPS: `http://localhost:3210`
   - MMS: `http://localhost:3201`
   - WMS: `http://localhost:3202`
   - SRS: `http://localhost:3203`

## 9. If startup fails
- Check infra:
  - `docker compose -f .\scripts\docker-compose.infra.yml ps`
- Check logs:
  - `docker logs ems-ldap-local --tail=120`
  - `docker logs ems-eps-db-local --tail=120`
  - `docker logs ems-mms-db-local --tail=120`
  - `docker logs ems-wms-db-local --tail=120`
