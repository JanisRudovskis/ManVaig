# AGENTS.md — Ralph Operational Guide

Read this every iteration. It overrides any default assumptions Ralph might make from the codebase scan.

## Build / Run

| What | Command |
|---|---|
| Backend run | `cd backend && dotnet run --project ManVaig.Api` (port 5100) |
| Backend build | `cd backend && dotnet build ManVaig.sln` |
| Generate migration | `cd backend && dotnet ef migrations add NAME --project ManVaig.Api` |
| List migrations | `cd backend && dotnet ef migrations list --project ManVaig.Api` |

This cycle is **BACKEND-ONLY**. Do NOT touch `frontend/**`. Frontend changes are a separate cycle.

There is NO unit test framework. Do NOT install xunit/nunit. This branch does not require new tests.

## Stack

- Backend: ASP.NET 9, EF Core, PostgreSQL, JWT auth
- API routes: ALWAYS `/api/v1/...`

## Non-negotiable conventions

- **Mirror existing patterns.** Other public controllers (`PublicStallsController`, `PublicItemsController`) and DTO files (`PublicItemDtos.cs`, `StallDtos.cs`) are the templates.
- **Migration backfill MUST preserve current behavior.** Existing stalls get `Visibility=Public`, defaults null/false. No silent behavior change for existing data.
- **No tests** unless explicitly asked. **No doc updates** unless explicitly asked (don't touch ROADMAP.html, ARCHITECTURE.md, etc).

## Reuse — these patterns already exist

| Need | Use |
|---|---|
| Visibility enum pattern | `Models/Enums/ItemVisibility.cs` (4 states, Public=0, RegisteredOnly=1, LinkOnly=2, Private=3 — match `StallVisibility` integers exactly) |
| Item.Visibility detail switch | `PublicItemsController` Detail action — keep existing switch intact, ADD stall-gate BEFORE it |
| Browse query filter pattern | `PublicStallsController.Browse` and `PublicItemsController.Browse` |
| User-listings cascade | `ProfileController.GetUserListings` — extend existing `i.Visibility == Public` filter with `&& i.Stall.Visibility == Public` |
| Validation error response shape | Existing controllers return `BadRequest(new { error = "ERROR_CODE" })` |
| JSON column for tags | `System.Text.Json.JsonSerializer.Serialize(list)` to store, `Deserialize<List<string>>` on read. Stored as `string?` column type. |
| Composable defaults pattern | `Item` already has `Category/Location/CanShip/Tags/Condition/AcceptOffers` — same field types/shapes; stall defaults are NULLABLE counterparts that pre-fill new items (frontend-side wiring is a separate cycle) |
| Composite-index slug uniqueness | `Stall` already uses `(UserId, Slug)` composite index — keep it as-is |

## Composition rules (the load-bearing part)

- **Browse** (`/api/v1/public/stalls` and `/api/v1/public/items`) lists ONLY `stall.Visibility == Public AND item.Visibility == Public`. Other states are direct-link-only — including for authed users.
- **Detail** (`GET /api/v1/public/items/{id}`): stall-gate FIRST (Private → 404 non-owner; RegisteredOnly → 401 anon; LinkOnly/Public → fall through), THEN existing item-visibility switch (unchanged).
- **Owner always sees own content** regardless of any visibility level.
- **`IsDefault==true` requires `Visibility==Public`** — API rejects with `IS_DEFAULT_REQUIRES_PUBLIC`.

## Branch & commits

- Working branch: `ralph/stall-redesign-backend` (do not push to or merge into master)
- Commit style: conventional, lowercase verb (`feat:`, `fix:`, `refactor:`)
- One commit per task
- Note: project's deny list MAY block `git commit *`. Last cycle (people-search) committed cleanly though. If commits are blocked, surface in iteration output and stage changes; the human will commit in chunks.

## Out of scope for this cycle

- **Frontend changes** (`frontend/**`) — completely off-limits
- Public stall detail page endpoint — separate cycle
- Toast/warning UX when a stall change hides items
- Bulk-apply stall defaults to existing items
- Doc updates
