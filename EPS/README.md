# DEPS Equipment Passport MVP

## Stack
- Next.js (App Router)
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- shadcn/ui-style component primitives

## Quick start
1. Copy `.env.example` to `.env`.
2. Install dependencies: `npm install`.
3. Generate client: `npm run prisma:generate`.
4. Apply migrations: `npm run prisma:migrate`.
5. Seed data: `npm run prisma:seed`.
6. Run app: `npm run dev`.

## Environment profiles
- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

## Auth (LDAP-ready)
- Production login page: `/login`
- API login endpoint: `POST /api/auth/login`
- Session cookie: `auth_user` (HttpOnly)
- Debug auth routes are disabled by default (`ENABLE_DEBUG_AUTH_ROUTES=false`)

## Health / Observability
- Health endpoint: `GET /api/health`
- Checks:
  - database
  - auth provider (LDAP/mock)
  - local storage

## Storage (local only)
- Local private storage driver only (`STORAGE_DRIVER=local`)
- Storage mode via settings: `UPLOADS` or `NETWORK_DRIVE`
- Files are saved in `data/uploads` or target network path
- File download is controlled by API RBAC route: `GET /api/files/download?path=...`

## Run Scripts
- Full run: `npm run ops:run`
- Validation: `npm run ops:check`
- Validation + production build: `npm run ops:check:build`
- Smoke check: `npm run ops:smoke`
- Unit/local tests: `npm run test`

### Prisma / DB
- `npm run prisma:migrate:deploy`
- `npm run prisma:migrate:status`
- `npm run ops:db:backup`
- `npm run ops:db:restore -- -Input <dump>`
- `npm run ops:db:restore:test -- -Input <dump> [-SkipRestore]`

### Production guards
- `npm run ops:prod:preflight`

### LDAP debug stand
- `npm run ldap:up`
- `npm run ldap:logs`
- `npm run ldap:down`

### Production docker
- `npm run ops:prod:up`
- `npm run ops:prod:down`

### Offline bundle
- `bash ./scripts/create-offline-bundle.sh`

### Load test
- `npm run ops:loadtest:health` (requires `k6` installed)

## Roles
- VIEWER
- EDITOR
- APPROVER
- ADMIN

## Key features
- Equipment registry and details
- Equipment/document versioning
- Approval workflow
- Audit log
- LDAP-ready auth abstraction
- Aggregated project settings module

## Operations docs
- [Operations Guide](docs/OPERATIONS.md)
- [Prod Readiness](docs/PROD_READINESS.md)
- [Runbook](docs/RUNBOOK.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Manual run (PostgreSQL + LDAP + Nginx)](docs/MANUAL_RUN_POSTGRES_NGINX_LDAP.md)
