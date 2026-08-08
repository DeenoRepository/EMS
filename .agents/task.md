# Task: Fix Missing Icons for WMS Sub-sections in Sidebar

## 1. Frontend Architect Agent (`nextjs-frontend-architect`)
- [ ] Inspect `src/components/layout/sidebar.tsx` and icon mapping.
- [ ] Ensure child nav items render `iconName` icons properly in the sidebar navigation.
- [ ] Verify `src/lib/config/nav.ts` icon names match Lucide icon registry.

## 2. Code Review & QA Agent (`qa-code-reviewer`)
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
