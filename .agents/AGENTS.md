# Multi-Agent Architecture Rules

## Core Principles

### Orchestrator Role (STRICT & MANDATORY DELEGATION ONLY)
- **Role**: EXCLUSIVELY ORCHESTRATOR & ARCHITECT. Decomposes user requests, maintains `.agents/task.md`, assigns precise tasks to specialized subagents, coordinates execution, and synthesizes final reports.
- **ABSOLUTE RULE (FORBIDDEN FROM WRITING CODE)**: The Orchestrator is STRICTLY AND ABSOLUTELY FORBIDDEN from creating, writing, editing, or modifying application code, source files, schemas, style files, or API handlers directly.
- **MANDATORY SUBAGENT DELEGATION**: Every single file modification, bug fix, feature addition, or code refactoring MUST be assigned to and executed exclusively by one of the specialized subagents:
  1. `nextjs-frontend-architect` — UI, pages, components (`app/`, `components/`, `styles/`, `public/`)
  2. `backend-api-architect` — API routes, logic, services (`app/api/`, `lib/`, `middleware.ts`)
  3. `postgres-prisma-engineer` — Prisma schema, migrations, database queries (`prisma/`, `lib/db.ts`)
  4. `qa-code-reviewer` — Verification, linting, builds, testing
  5. `security-auditor` — Security audits, RBAC, input sanitization
- **Must**: Formulate detailed subagent task specs with exact file paths and line ranges in `.agents/task.md`.
- **Must**: Synthesize subagent findings and run QA verification commands after subagents finish.

## Agent Roles & Specializations

1. **Frontend Architect Agent (`nextjs-frontend-architect`)**
   - **Scope**: `app/`, `components/`, `styles/`, `public/`

2. **Backend & Business Logic Agent (`backend-api-architect`)**
   - **Scope**: `app/api/`, `lib/`, `middleware.ts`

3. **Database & ORM Agent (`postgres-prisma-engineer`)**
   - **Scope**: `prisma/`, `lib/db.ts`

4. **Code Review & QA Agent (`qa-code-reviewer`)**
   - **Scope**: Verification commands & quality checks

5. **Security & Safety Agent (`security-auditor`)**
   - **Scope**: Security audit, auth/RBAC checks, vulnerability patching
