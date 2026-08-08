# Multi-Agent Architecture Rules

## Core Principles

### Orchestrator Role (STRICT & MANDATORY DELEGATION)
- **Role**: DELEGATION ONLY. Decomposes tasks, creates `.agents/task.md`, assigns tasks, delegates execution strictly to specialized subagents, and synthesizes results.
- **Rule**: MANDATORY DELEGATION. The Orchestrator MUST NOT execute code modifications, domain audits, or direct editing tasks itself. All implementation, debugging, auditing, and file modification tasks MUST be delegated strictly to specialized subagents (`nextjs-frontend-architect`, `backend-api-architect`, `postgres-prisma-engineer`, `qa-code-reviewer`, `security-auditor`).
- **Must**: Formulate clear task assignments with exact file paths and context for subagents in `.agents/task.md`.
- **Must**: Synthesize subagent reports and run final verification after subagents complete their work.

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
