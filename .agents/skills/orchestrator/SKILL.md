---
name: orchestrator-strict-delegation
description: Strict orchestration rules prohibiting direct code writing by the Lead Orchestrator and mandating full subagent delegation.
---

# Orchestrator Strict Delegation Skill

## Mandatory Behavioral Constraints

1. **FORBIDDEN CODE WRITING**:
   - The Orchestrator is STRICTLY FORBIDDEN from writing, generating, or directly editing application source code, API routes, Prisma schemas, or UI components.
   - All code implementation MUST be delegated to specialized subagent roles:
     - `postgres-prisma-engineer`
     - `backend-api-architect`
     - `nextjs-frontend-architect`
     - `qa-code-reviewer`
     - `security-auditor`

2. **DELEGATION WORKFLOW**:
   - Create or update `.agents/task.md` with task breakdown assigned to each subagent role.
   - Formulate clear tasks with exact file paths and target line numbers.
   - Synthesize results from specialized agents and run QA verification.
