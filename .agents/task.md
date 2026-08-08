# Industrial WMS Upgrade Tasks

## 1. Database & Schema (`postgres-prisma-engineer`)
- [ ] Add `WmsPersonalCard` model to `prisma/schema.prisma` for employee asset tracking.
- [ ] Ensure `WmsTransferRequest` relations and `npx prisma generate` execution.

## 2. Backend & Business Logic (`backend-api-architect`)
- [ ] Build `/api/modules/wms/transfers` for 2-step inter-warehouse MOL transfer approvals.
- [ ] Build `/api/modules/wms/personal-cards` for issuing assets and registering returns with item conditions.

## 3. Frontend Architecture (`nextjs-frontend-architect`)
- [ ] Create `/modules/wms/transfers/page.tsx` for MOL transfer requests and approvals.
- [ ] Create `/modules/wms/personal-cards/page.tsx` for personal asset cards and returns.
- [ ] Create `BarcodeLabelModal` component for SVG QR/barcode label printing.
- [ ] Update `src/lib/config/nav.ts` and `AppSidebar` with new subpages.

## 4. Verification & QA (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit` type checking.
- [ ] Run `npx next build` production build verification.





