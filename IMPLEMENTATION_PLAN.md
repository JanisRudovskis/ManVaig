# Implementation Plan

## Goal

Add 4-state Visibility (Public / RegisteredOnly / LinkOnly / Private) to Stall, mirroring `ItemVisibility`, plus stall-level defaults for new items (`DefaultCategoryId`, `DefaultLocation`, `DefaultCanShip`, `DefaultTagsJson`, `DefaultCondition`, `DefaultAcceptOffers`). Cascade visibility filtering through `PublicStallsController`, `PublicItemsController`, and `ProfileController` so non-Public stalls hide their items from public browse and direct-link semantics work correctly. **Backend-only cycle** — frontend changes are a separate cycle.

## Privacy/visibility contract (load-bearing)

- **Stall visibility states** (mirror `ItemVisibility` integer assignments): `Public=0, RegisteredOnly=1, LinkOnly=2, Private=3`.
- **Composition** — most-restrictive wins, orthogonal axes. If EITHER `stall.Visibility` OR `item.Visibility` imposes a constraint, that constraint applies to the item.
- **Browse** (`/api/v1/public/stalls` and `/api/v1/public/items`) lists ONLY rows where `stall.Visibility == Public` AND `item.Visibility == Public`. All other states are direct-link-only — including for authed users. Matches existing item-side behavior.
- **Detail** (`GET /api/v1/public/items/{id}`):
  1. Stall gate FIRST: `Private` → 404 to non-owner; `RegisteredOnly` → 401 to anon; `LinkOnly`/`Public` → fall through
  2. Item gate (existing logic, unchanged): `Private` → 404 to non-owner; `RegisteredOnly` → 401 to anon; `LinkOnly`/`Public` → 200
- **Owner always sees own content** regardless of visibility.
- **`IsDefault==true` requires `Visibility==Public`** — API rejects otherwise (prevents the "default stall is Private → all items invisible" footgun). Error code `IS_DEFAULT_REQUIRES_PUBLIC`.

## Composition matrix (verification reference)

| Stall \ Item | Public | RegisteredOnly | LinkOnly | Private |
|---|:-:|:-:|:-:|:-:|
| **Public** | Browse + link | Login wall (detail) | Direct link only | Owner only |
| **RegisteredOnly** | Login wall | Login wall | Login wall + direct link | Owner only |
| **LinkOnly** | Direct link only | Login wall + direct link | Direct link only | Owner only |
| **Private** | Owner only | Owner only | Owner only | Owner only |

Public×Public is the ONLY cell that surfaces in browse listings.

## Context (from codebase exploration)

- **`Models/Enums/ItemVisibility.cs`** has `Public=0, RegisteredOnly=1, LinkOnly=2, Private=3`. New `StallVisibility` MUST use the same integer assignments.
- **`Models/Stall.cs`** currently has: `Id, UserId, Name, Slug, Description, ThumbnailUrl, HeaderImageUrl, BackgroundImageUrl, AccentColor, SortOrder, IsDefault, CreatedAt, UpdatedAt`. Slug is unique-per-user via composite index `(UserId, Slug)`.
- **`Models/Item.cs`** — `StallId` is REQUIRED (not nullable). `CategoryId` is `int` (NOT Guid) — important for the FK type on `DefaultCategoryId`. Has `Tags` via `ItemTags` join table. Has `Visibility` (`ItemVisibility`), `Location` (`string?`), `CanShip` (`bool`), `Condition` (`Condition` enum), `AcceptOffers` (`bool`).
- **`PublicStallsController.Browse`** filter currently: `Where(s => s.Items.Any(i => i.Visibility == ItemVisibility.Public))`. Needs `&& s.Visibility == StallVisibility.Public` added.
- **`PublicItemsController.Browse`** filter currently: `Where(i => i.Visibility == ItemVisibility.Public)`. Needs `&& i.Stall.Visibility == StallVisibility.Public` added.
- **`PublicItemsController.Detail`** has a switch on `item.Visibility` (Public, RegisteredOnly, LinkOnly, Private) at lines ~126-140. Keep that switch intact and add a stall-visibility gate BEFORE it.
- **`ProfileController.GetUserListings`** filters items by `i.Visibility == ItemVisibility.Public`. Add `&& i.Stall.Visibility == StallVisibility.Public`.
- **`ProfileController.MapToResponse.ActiveListingCount`** counts `i.Visibility == Public`. Same cascade.
- **`Models/Dto/StallDtos.cs`** has `CreateStallRequest` (Name/Description/AccentColor), `UpdateStallRequest` (Name/Slug/Description/AccentColor), `StallResponse` (full set), `PublicStallResponse`. **DO NOT expose Visibility on `PublicStallResponse`** — non-Public stalls won't surface in public endpoints anyway, no need to leak.
- **`StallsController`** is at `Controllers/V1/StallsController.cs`. Map new fields in Create/Update/Map. Validate the new constraints there.
- **Existing item-tag char regex** lives in item validation logic; reuse pattern for stall default-tags.

## Tasks

### Task 1: Backend — add `StallVisibility` enum
- **Files:** `backend/ManVaig.Api/Models/Enums/StallVisibility.cs` (new)
- **Action:** Create new file:
  ```csharp
  namespace ManVaig.Api.Models.Enums;

  public enum StallVisibility
  {
      Public = 0,
      RegisteredOnly = 1,
      LinkOnly = 2,
      Private = 3
  }
  ```
  Mirror `ItemVisibility` integer assignments exactly.
- **Verify:** `cd backend && dotnet build ManVaig.sln` — 0 errors.
- **Parallel:** true (foundation for Tasks 2–6)
- **Status:** [x] Complete

### Task 2: Backend — migration `AddStallVisibilityAndDefaults` + Stall model fields
- **Files:** `backend/ManVaig.Api/Models/Stall.cs`, `backend/ManVaig.Api/Migrations/{timestamp}_AddStallVisibilityAndDefaults.cs` (new), `backend/ManVaig.Api/Migrations/AppDbContextModelSnapshot.cs` (auto-updated)
- **Action:**
  1. In `Stall.cs` add the 7 new fields:
     ```csharp
     public StallVisibility Visibility { get; set; } = StallVisibility.Public;
     public int? DefaultCategoryId { get; set; }
     public Category? DefaultCategory { get; set; }   // navigation, nullable
     public string? DefaultLocation { get; set; }
     public bool DefaultCanShip { get; set; } = false;
     public string? DefaultTagsJson { get; set; }    // JSON-encoded list of tag-name strings
     public Condition? DefaultCondition { get; set; } // nullable enum
     public bool DefaultAcceptOffers { get; set; } = false;
     ```
     Add `using ManVaig.Api.Models.Enums;` if not already.
  2. Generate migration: `cd backend && dotnet ef migrations add AddStallVisibilityAndDefaults --project ManVaig.Api`. Verify the generated migration includes explicit `defaultValue: 0` for `Visibility` and `defaultValue: false` for the bools so existing rows backfill cleanly.
  3. The `Migrate()` call at startup (`Program.cs`) applies it on next API boot.
- **Verify:**
  1. `cd backend && dotnet build ManVaig.sln` — 0 errors.
  2. `dotnet ef migrations list --project ManVaig.Api` lists the new migration.
  3. After API restart, existing stalls show `Visibility=0` (Public) and all defaults null/false — no behavior change.
- **Parallel:** false (depends on Task 1)
- **Status:** [x] Complete

### Task 3: Backend — extend StallDtos
- **Files:** `backend/ManVaig.Api/Models/Dto/StallDtos.cs`
- **Action:** Extend three DTOs (DO NOT touch `PublicStallResponse` — non-Public stalls don't surface in public endpoints):
  - `CreateStallRequest`: + `Visibility` (`StallVisibility`, default `Public`), + `DefaultCategoryId` (`int?`), + `DefaultLocation` (`string?`), + `DefaultCanShip` (`bool` default false), + `DefaultTags` (`List<string>?`, max 10 — server serializes to JSON for storage), + `DefaultCondition` (`Condition?`), + `DefaultAcceptOffers` (`bool` default false).
  - `UpdateStallRequest`: same additions, but make bool fields `bool?` to allow partial updates (existing fields like `Name` are nullable strings — same pattern). Server only writes a field if non-null in the request.
  - `StallResponse`: + `Visibility`, + `DefaultCategoryId`, + `DefaultCategoryName` (string?, joined from `Category` navigation), + `DefaultLocation`, + `DefaultCanShip`, + `DefaultTags` (`List<string>` deserialized from JSON; empty list when JSON null), + `DefaultCondition`, + `DefaultAcceptOffers`.
- **Verify:** `cd backend && dotnet build ManVaig.sln` — 0 errors.
- **Parallel:** true (independent; can run alongside Task 2 once Task 1 lands)
- **Status:** [x] Complete

### Task 4: Backend — `StallsController` accept new fields + validate constraints
- **Files:** `backend/ManVaig.Api/Controllers/V1/StallsController.cs`
- **Action:**
  1. In `Create` and `Update` actions:
     - Map new fields from request to entity. For tags: `entity.DefaultTagsJson = request.DefaultTags == null ? null : JsonSerializer.Serialize(request.DefaultTags);`
     - **Validate** `request.DefaultTags?.Count <= 10`; each tag length ≤ 30 chars; each tag matches the existing item-tag regex (find it in item validation — same pattern).
     - **Validate** if `DefaultCategoryId.HasValue`: `await _db.Categories.AnyAsync(c => c.Id == DefaultCategoryId.Value)` — 400 with `INVALID_CATEGORY` if not.
     - **Validate** `IsDefault → Public`: when `request.IsDefault == true && request.Visibility != StallVisibility.Public`, return 400 with `IS_DEFAULT_REQUIRES_PUBLIC`. Apply on both Create AND Update.
     - **Validate** `DefaultLocation?.Length <= 200`.
  2. In response mapping (Map / `MapToResponse`), populate the new response fields. Deserialize `DefaultTagsJson` back to `List<string>` (empty list if null). Look up `DefaultCategory.Name` via `.Include(s => s.DefaultCategory)` on the EF query so it's available for the response.
  3. Make sure `Get` (single) and `List` endpoints' EF queries include the navigation: `.Include(s => s.DefaultCategory)` so response can populate `DefaultCategoryName`.
- **Verify:**
  1. `cd backend && dotnet build ManVaig.sln` — 0 errors.
  2. After API restart with valid auth: `curl -X POST -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"name":"TestStall","visibility":1,"defaultCategoryId":1,"defaultCanShip":true,"defaultTags":["vintage","leather"]}' http://localhost:5100/api/v1/stalls` → 201 with new fields populated in response.
  3. POST with `"isDefault":true,"visibility":2` → 400 with `IS_DEFAULT_REQUIRES_PUBLIC`.
  4. POST with 11 tags → 400.
- **Parallel:** false (depends on Task 3)
- **Status:** [ ] Pending

### Task 5: Backend — Browse cascades (`PublicStallsController` + `PublicItemsController`)
- **Files:** `backend/ManVaig.Api/Controllers/V1/PublicStallsController.cs`, `backend/ManVaig.Api/Controllers/V1/PublicItemsController.cs`
- **Action:**
  1. In `PublicStallsController.Browse` query, add `Where(s => s.Visibility == StallVisibility.Public)` to the existing filter chain (alongside the existing `Where(s => s.Items.Any(i => i.Visibility == ItemVisibility.Public))`). Both apply.
  2. In `PublicItemsController.Browse` query, add `.Where(i => i.Stall.Visibility == StallVisibility.Public)` to the existing `i.Visibility == ItemVisibility.Public` filter. Both apply (Public×Public only).
  3. Add `using ManVaig.Api.Models.Enums;` if not already present.
- **Verify:**
  1. `cd backend && dotnet build ManVaig.sln` — 0 errors.
  2. `curl http://localhost:5100/api/v1/public/stalls` returns same set as before (all existing stalls backfilled to Public).
  3. Mark a test stall Private via `PUT /api/v1/stalls/{id}`; restart not required if same backend instance. `curl /api/v1/public/stalls` no longer lists it. Items inside don't appear in `curl /api/v1/public/items`.
  4. Toggle stall back to Public → reappears.
- **Parallel:** false (depends on Tasks 1, 2, 4)
- **Status:** [ ] Pending

### Task 6: Backend — Detail stall-gate + `ProfileController` cascades
- **Files:** `backend/ManVaig.Api/Controllers/V1/PublicItemsController.cs`, `backend/ManVaig.Api/Controllers/V1/ProfileController.cs`
- **Action:**
  1. In `PublicItemsController.Detail` (the `GET /api/v1/public/items/{id}` action), AFTER fetching the item with `.Include(i => i.Stall)` (verify the stall is already loaded — if not, ADD that include), BEFORE the existing `switch (item.Visibility)` block, add a stall-visibility gate:
     ```csharp
     bool isAuthenticated = User.Identity?.IsAuthenticated == true;
     // Extract current user id from claims like the rest of the controller does
     // (use the same helper / pattern that the existing item-visibility switch uses for owner check)
     bool isOwner = isAuthenticated && currentUserId == item.Stall.UserId;

     if (item.Stall.Visibility == StallVisibility.Private && !isOwner)
         return NotFound(new { error = "Item not found." });
     if (item.Stall.Visibility == StallVisibility.RegisteredOnly && !isAuthenticated)
         return Unauthorized(new { error = "Authentication required." });
     // LinkOnly stall and Public stall → fall through to existing item.Visibility switch
     ```
     Then the existing `switch (item.Visibility) { ... }` runs unchanged.
  2. In `ProfileController.GetUserListings`, change the items query filter from `Where(i => i.UserId == user.Id && i.Visibility == ItemVisibility.Public)` to `Where(i => i.UserId == user.Id && i.Visibility == ItemVisibility.Public && i.Stall.Visibility == StallVisibility.Public)`.
  3. In `ProfileController.MapToResponse`, the `ActiveListingCount = await _db.Items.CountAsync(i => i.UserId == user.Id && i.Visibility == ItemVisibility.Public)` becomes `... && i.Stall.Visibility == StallVisibility.Public` for honesty (count matches what's actually surfaced).
- **Verify:**
  1. `cd backend && dotnet build ManVaig.sln` — 0 errors.
  2. Item in a Private stall: `curl http://localhost:5100/api/v1/public/items/{id}` (anon) → 404; with valid owner JWT → 200.
  3. Item in a RegisteredOnly stall: `curl /api/v1/public/items/{id}` (anon) → 401; with any valid auth JWT → 200.
  4. `curl /api/v1/users/{displayName}/listings` reflects the cascade — items in non-Public stalls hidden.
  5. The user profile's `activeListingCount` matches the new filter.
- **Parallel:** false (depends on Tasks 1, 2, 5)
- **Status:** [ ] Pending

## Out of scope (this cycle)

- **Frontend changes** (`frontend/**`) — completely off-limits. `StallFormDialog`, `VisibilityRadioCards`, `lib/stalls.ts`, ItemForm wiring, i18n — all separate cycle.
- Public stall detail page (`/stalls/[slug]`) — separate cycle
- Toast/warning UX when a stall change hides items
- Bulk-apply stall defaults to existing items
- Doc updates (ROADMAP.html, ARCHITECTURE.md, etc.)

## Completion Promise

**DOTNET BUILD SUCCEEDS AND MIGRATION APPLIES AND BROWSE FILTERS CASCADE STALL VISIBILITY AND DETAIL GATES STALL VISIBILITY FIRST**

Verify at end of build phase:
1. `cd backend && dotnet build ManVaig.sln` — exits 0, 0 errors
2. `dotnet ef migrations list --project ManVaig.Api` shows `AddStallVisibilityAndDefaults`
3. After API restart, `curl /api/v1/public/stalls` and `curl /api/v1/public/items` return same content as before backfill (all existing rows are Public — no public-consumer-visible behavior change)
4. Mark a stall Private → it disappears from `/api/v1/public/stalls`; its items disappear from `/api/v1/public/items`; direct GET on its items → 404 to anon, 200 to owner
5. Mark a stall RegisteredOnly → browse-hidden; direct item GET → 401 to anon, 200 to authed
6. POST creating a stall with `IsDefault=true, Visibility=Private` → 400 with `IS_DEFAULT_REQUIRES_PUBLIC`
