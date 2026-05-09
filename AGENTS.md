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

There is NO unit test framework. Do NOT install Vitest/Jest. This branch does not require new tests.

## Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui (`@base-ui/react`), `next-intl`, `next-themes`, `lucide-react`
- Backend: ASP.NET 9, EF Core, PostgreSQL, JWT auth
- API routes: ALWAYS `/api/v1/...`

## Non-negotiable conventions

- **Mobile-first.** Default Tailwind classes target mobile; use `sm:`, `md:`, `lg:` only to upscale.
- **i18n.** Every user-facing string must come from `next-intl` (`useTranslations(...)`). Add keys to BOTH `frontend/messages/en.json` AND `frontend/messages/lv.json`. Never hardcode strings.
- **No browser-native validation.** Never use `required`, `minLength`, `type="email"` — write custom i18n-aware validation.
- **shadcn/ui only** for primitives. Do not introduce new UI libraries.
- **No tests** unless explicitly asked. **No doc updates** unless explicitly asked (don't touch ROADMAP.html, ARCHITECTURE.md, etc).

## Reuse — these already exist, do not rebuild

| Need | Use |
|---|---|
| **Search page shell pattern** (debounce, URL state, pagination, AbortController, ICU plural live region, empty/loading/error states) | `frontend/src/app/search/search-client.tsx` — copy the structure, trim to one tab |
| **Public list-endpoint pattern** (anonymous, paginated, `?q=`, ILIKE search, returns `{ Items|Stalls, TotalCount, Page, PageSize }`) | `backend/ManVaig.Api/Controllers/V1/PublicStallsController.cs` |
| **Card component pattern** (mobile-first, rounded-xl, skeleton variant exported alongside) | `frontend/src/components/public-stall-card.tsx` |
| **Public list client lib** (plain fetch, no auth, URLSearchParams, typed response) | `frontend/src/lib/stalls.ts` (`fetchPublicStalls`) |
| **Debounce hook** | `frontend/src/lib/use-debounced-value.ts` (already exists, do not duplicate) |
| **Avatar with initials fallback** | `frontend/src/components/user-avatar.tsx` |
| **Skeleton primitive** | `@/components/ui/skeleton` |
| **Sidebar More menu** (where the new entry goes) | `frontend/src/components/sidebar-more-menu.tsx` |

## Privacy contract for `/api/v1/public/users`

- Anonymous viewer → `IsActive AND IsProfilePublic` only.
- Authenticated viewer → `IsActive` only (sees public + private).
- If a user is in the result set at all, ALL fields render — no partial cards.
- DisplayName regex `[a-zA-Z0-9_-]{3,30}` → no diacritics → `EF.Functions.ILike` is enough; **do NOT add `EF.Functions.Unaccent`** for this controller.

## Backend — what's already there

- `LastSeenMiddleware` updates `ApplicationUser.LastSeenAt` on auth requests (5-min throttle). The data is free — just project it through.
- `EnabledChannels` is a flags enum: `WhatsApp=1, Telegram=2, ShowEmail=4, ShowPhone=8`. Compute `Has*` booleans on the server (see plan Task 2).
- Existing `PublicStallsController` and `PublicItemsController` are the controller-shape templates. Mirror them; add only what the privacy contract requires.

## Branch & commits

- Working branch: `ralph/people-search` (do not push to or merge into master)
- Commit style: conventional, lowercase verb (`feat:`, `fix:`, `refactor:`)
- One commit per task
- **Note:** the project's `.claude/settings.local.json` denies `git commit *` and `git push *` for the agent. Stage changes; the human will commit in chunks. If commits are blocked, do not stall the loop — surface the blocker in the iteration output.

## Out of scope for this branch

- Online presence (heartbeat / websocket) — `LastSeenAt` only
- Filters or sort UI on `/people`
- New sidebar nav item — entry stays in More menu
- In-app messaging
- DB unique index on DisplayName
- Doc updates (ROADMAP, ARCHITECTURE)
