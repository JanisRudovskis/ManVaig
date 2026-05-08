# AGENTS.md — Ralph Operational Guide

Read this every iteration. It overrides any default assumptions Ralph might make
from the codebase scan.

## Build / Run / Lint

| What | Command |
|---|---|
| Frontend dev | `cd frontend && npm run dev` (port 3000) |
| Frontend build | `cd frontend && npm run build` |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend type-check | `cd frontend && npx tsc --noEmit` |
| Backend run | `cd backend && dotnet run --project ManVaig.Api` (port 5100) |
| Backend build | `cd backend && dotnet build ManVaig.sln` |
| E2E (Playwright) | `cd frontend && npm run test:e2e` |

There is NO unit test framework. Do NOT install Vitest/Jest. E2E only, and
only when explicitly asked. This branch does not require new tests.

## Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui (`@base-ui/react`), `next-intl`, `next-themes`, `lucide-react`
- Backend: ASP.NET 9, EF Core, PostgreSQL, JWT auth
- API routes: ALWAYS `/api/v1/...`

## Non-negotiable conventions

- **Mobile-first.** Default Tailwind classes target mobile; use `sm:`, `md:`, `lg:` only to upscale.
- **i18n.** Every user-facing string must come from `next-intl` (`useTranslations(...)`). Add keys to BOTH `frontend/messages/en.json` AND `frontend/messages/lv.json`. Never hardcode strings.
- **No browser-native validation.** Never use `required`, `minLength`, `type="email"` — write custom i18n-aware validation.
- **shadcn/ui only** for primitives (Button, Input, Card, Dialog, etc.). Do not introduce new UI libraries.
- **No tests** unless explicitly asked. No new test files for this branch.
- **No doc updates** unless explicitly asked. Don't touch ROADMAP.html, ARCHITECTURE.md, etc.

## Reuse — these already exist, do not rebuild

| Need | Use |
|---|---|
| Public item card | `frontend/src/components/public-item-card.tsx` |
| Item card shared bits (price pill, end-date pill, `timeAgo`) | `frontend/src/components/item-card-shared.tsx` |
| Item types & API helpers | `frontend/src/lib/items.ts` |
| Stall types & API helpers | `frontend/src/lib/stalls.ts` |
| Auth helpers | `frontend/src/lib/auth.ts` + `auth-context.tsx` |
| Skeleton loading | `@/components/ui/skeleton` |
| Layout/sidebar | `frontend/src/components/app-layout.tsx` |
| Empty-state pattern reference | `frontend/src/app/my-items/page.tsx`, `frontend/src/app/my-stalls/page.tsx` |

## Backend — what's already there

- `PublicItemsController` (`GET /api/v1/public/items`) — already supports `categoryId`, `page`, `pageSize`. **Needs `?q=` text-search added.**
- `StallsController` (`GET /api/v1/stalls`) — auth-required, internal CRUD. **NOT public.** A new `PublicStallsController` mirroring `PublicItemsController` is needed if you want public stall browse.

## Branch & commits

- Working branch: `ralph/stalls-items-search` (do not push to or merge into master)
- Commit style: conventional, lowercase verb (`feat:`, `fix:`, `refactor:`)
- One commit per task

## Out of scope for this branch

- Filters (price/condition/location) — pass 2 only
- New test frameworks
- Doc updates
- Refactoring unrelated to the search feature
