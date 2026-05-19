# WMS Functional Freeze Policy

## Freeze scope
- New features are paused.
- Only fixes allowed:
  - Production/blocking bugs (P1/P2)
  - Data integrity defects
  - Security/access control defects
  - MMS/EPS integration reliability defects

## Change gate
1. Reproduce issue and attach steps.
2. Add/adjust test or checklist row in `docs/WMS_E2E_CHECKLIST.md`.
3. Validate in Docker (`wms-app` + required dependencies).
4. Update `docs/WMS_RUNBOOK.md` if operation changes.

## Release criteria
- No open P1/P2 defects.
- E2E checklist passed for `ADMIN`, `CENTRAL`, `AUXILIARY`.
- Sync-status endpoint healthy: `/api/wms/integrations/mms/sync-status`.
- Build and runtime logs have no repeated fatal errors.
