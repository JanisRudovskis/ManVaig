# Implementation Plan

## Goal
Build a unified /search page with a Stalls | Items tab toggle. Reuse the existing /api/v1/public/items endpoint and add a parallel /api/v1/public/stalls. Add ?q= text-search support to both. MVP: text search + result list cards (mobile-first, shadcn/ui, EN+LV i18n). Required: empty state, skeleton loading state, debounced input (300ms). No filters in this pass.

## Context (from codebase exploration)

- **Existing items endpoint** — `backend/ManVaig.Api/Controllers/V1/PublicItemsController.cs` `GET /api/v1/public/items` already supports `page`, `pageSize`, `categoryId`. Needs `?q=` added (search title, description, tag names).
- **Stalls** — only owner endpoints exist (`/api/v1/stalls`, `[Authorize]`). DTO `PublicStallResponse` already defined in `backend/ManVaig.Api/Models/Dto/StallDtos.cs` but no public controller. Stalls are tied to a single owner; `Stall` model has Name, Slug, Description, AccentColor, ThumbnailUrl, HeaderImageUrl, BackgroundImageUrl, ItemCount derived.
- **Frontend client lib** — `frontend/src/lib/items.ts` has `fetchPublicItems(page, pageSize, categoryId, signal)`. `frontend/src/lib/stalls.ts` only has authed stall functions. Both need extension.
- **Sidebar nav** — `frontend/src/components/app-sidebar.tsx` already maps `key: "browse"` -> `/browse` (no page exists). We retarget to `/search`.
- **shadcn components installed** — no `tabs` component yet; will use a simple segmented button toggle (consistent with Condition segmented in ItemForm) instead of installing tabs.
- **i18n** — namespaces under `frontend/messages/{en,lv}.json`. No `search` namespace exists yet. Pattern: `useTranslations("search")` in client component.
- **Reuse** — `PublicItemCard` component (`frontend/src/components/public-item-card.tsx`) already renders item cards from `PublicItemCardType` and triggers `ItemDetailModal` + `OffersPopup` on click. `ItemCardSkeleton` is exported from `item-card-shared.tsx`.
- **Locale-aware case-insensitive search** — backend uses Npgsql; use `EF.Functions.ILike(field, $"%{q}%")` for Postgres ILIKE, wrapped with `EF.Functions.Unaccent(...)` on BOTH sides so Latvian diacritics fold (`Rīga` matches `riga`). Trim/lowercase q server-side; cap length at 100 chars to avoid pathological queries. Min query length enforced client-side (2 chars).
- **`unaccent` Postgres extension** is required — added in Task 1 as an EF migration. Applying `unaccent()` on an indexed column bypasses the index in v1 (acceptable for current data volume; revisit with `pg_trgm` if needed).

## Tasks

### Task 1: Backend — add Postgres `unaccent` extension migration
- **Files:** `backend/ManVaig.Api/Migrations/20260508173423_AddUnaccentExtension.cs` (new), `backend/ManVaig.Api/Migrations/AppDbContextModelSnapshot.cs` (auto-updated)
- **Action:** Generate a new EF Core migration that executes `CREATE EXTENSION IF NOT EXISTS unaccent;` in `Up()` and `DROP EXTENSION IF EXISTS unaccent;` in `Down()`. Use `migrationBuilder.Sql(...)`. Run via `dotnet ef migrations add AddUnaccentExtension --project backend/ManVaig.Api`. The `Migrate()` call at startup (`Program.cs:97`) will apply it on next API boot. Verify the extension is present after `dotnet run` against a clean DB.
- **Verify:** `cd backend && dotnet build ManVaig.sln`; `dotnet ef migrations list --project ManVaig.Api` lists the new migration. After running the API, `psql` query `SELECT extname FROM pg_extension WHERE extname = 'unaccent';` returns one row.
- **Parallel:** false (foundation for Tasks 2 and 4)
- **Status:** [x] Complete

### Task 2: Backend — add ?q= text search to PublicItemsController.Browse
- **Files:** `backend/ManVaig.Api/Controllers/V1/PublicItemsController.cs`
- **Action:** Add `[FromQuery] string? q = null` parameter to `Browse`. When `q` is non-null/whitespace, trim, cap at 100 chars, build `pattern = $"%{q}%"`, then apply:
  ```csharp
  query = query.Where(i =>
      EF.Functions.ILike(EF.Functions.Unaccent(i.Title), EF.Functions.Unaccent(pattern)) ||
      (i.Description != null && EF.Functions.ILike(EF.Functions.Unaccent(i.Description), EF.Functions.Unaccent(pattern))) ||
      i.ItemTags.Any(it => EF.Functions.ILike(EF.Functions.Unaccent(it.Tag.Name), EF.Functions.Unaccent(pattern))));
  ```
  Keep `categoryId` filter behavior. Order by CreatedAt desc (no relevance ranking in MVP).
- **Verify:** `cd backend && dotnet build ManVaig.sln`; `curl "http://localhost:5100/api/v1/public/items?q=test&pageSize=5"` returns 200 with filtered items; `curl "http://localhost:5100/api/v1/public/items?q=riga"` matches an item titled "Rīga" (diacritic fold).
- **Parallel:** false (depends on Task 1; foundation for Task 5)
- **Status:** [x] Complete

### Task 3: Backend — add PublicStallListResponse DTO
- **Files:** `backend/ManVaig.Api/Models/Dto/StallDtos.cs`
- **Action:** Append a `PublicStallListResponse` class: `List<PublicStallResponse> Stalls`, `int TotalCount`, `int Page`, `int PageSize`. Used by Task 4.
- **Verify:** `cd backend && dotnet build ManVaig.sln`.
- **Parallel:** true (independent; Task 4 references this)
- **Status:** [x] Complete

### Task 4: Backend — create PublicStallsController with browse + search
- **Files:** `backend/ManVaig.Api/Controllers/V1/PublicStallsController.cs` (new)
- **Action:** New controller `[Route("api/v1/public/stalls")] [ApiController]`, anonymous. `GET` action `Browse` with `[FromQuery] int page = 1, int pageSize = 20, string? q = null`. Query `_db.Stalls` with includes for owner User + items + primary images. Only include stalls that have at least one `Item.Visibility == ItemVisibility.Public` so empty/private-only stalls are not exposed. When `q` set (trimmed, capped at 100 chars):
  ```csharp
  .Where(s =>
      EF.Functions.ILike(EF.Functions.Unaccent(s.Name), EF.Functions.Unaccent(pattern)) ||
      (s.Description != null && EF.Functions.ILike(EF.Functions.Unaccent(s.Description), EF.Functions.Unaccent(pattern))) ||
      EF.Functions.ILike(EF.Functions.Unaccent(s.User.DisplayName!), EF.Functions.Unaccent(pattern)))
  ```
  Project to existing `PublicStallResponse` DTO (Id, Name, Slug, Description, ThumbnailUrl, HeaderImageUrl, BackgroundImageUrl, AccentColor, ItemCount = public items only, PreviewImageUrls = up to 4 primary image URLs from public items, Owner = DisplayName/AvatarUrl/Location). Order by ItemCount desc then CreatedAt desc. Return `PublicStallListResponse`.
- **Verify:** `cd backend && dotnet build ManVaig.sln`; `curl "http://localhost:5100/api/v1/public/stalls?q=test"` returns 200 JSON.
- **Parallel:** false (depends on Tasks 1 and 3)
- **Status:** [x] Complete

### Task 5: Frontend — extend lib/items.ts + lib/stalls.ts with search clients
- **Files:** `frontend/src/lib/items.ts`, `frontend/src/lib/stalls.ts`, `frontend/src/app/page.tsx` (call-site update)
- **Action:**
  1. In `lib/items.ts` extend `fetchPublicItems` to accept `q?: string`. Refactor to options object form `fetchPublicItems({ page, pageSize, categoryId, q, signal })` and update homepage call site `app/page.tsx` accordingly. Append `q` to URLSearchParams when truthy and trimmed.
  2. In `lib/stalls.ts` add interface `PublicStallListResponse` and exported `fetchPublicStalls({ page, pageSize, q, signal })` hitting `/api/v1/public/stalls`. No auth header required (use plain `fetch`, not `authFetch`).
- **Verify:** `cd frontend && npx tsc --noEmit`. Homepage `/` still loads and paginates.
- **Parallel:** false (Tasks 6/7 depend on these types)
- **Status:** [x] Complete

### Task 6: Frontend — PublicStallCard component
- **Files:** `frontend/src/components/public-stall-card.tsx` (new)
- **Action:** Mobile-first card. Visual primitives must match `PublicItemCard`: same `rounded-xl`, same `border`, same shadow class, comparable height range (160–220px) so a mixed-card scroll feels coherent. Layout: header strip with `headerImageUrl` (or accent gradient fallback — overlay `bg-black/30` if text sits on the strip, since `AccentColor` is user-supplied and contrast is unguaranteed); avatar/thumbnail circle with `thumbnailUrl` or initials; stall name (truncate); owner display name + small avatar + location; item count badge; preview thumbnails strip — **cap at 3 thumbnails on `< sm:` (i.e., `< 640px`); show 4 from `sm:` upward**. Click links via `next/link` to `/u/{owner.displayName}` (existing public profile route — safe target until public stall page lands). Use shadcn `Card` + `Avatar` + `Badge`. Skeleton variant `PublicStallCardSkeleton` exported alongside.
- **Verify:** `cd frontend && npx tsc --noEmit`; renders on /search page in Task 7.
- **Parallel:** true (independent of Task 7 once Task 5 types exist)
- **Status:** [ ] Pending

### Task 7: Frontend — /search page with tab toggle, debounced search, pagination
- **Files:** `frontend/src/app/search/page.tsx` (new), `frontend/src/lib/use-debounced-value.ts` (new)
- **Action:**
  - `use-debounced-value.ts`: tiny generic `useDebouncedValue<T>(value, delayMs)` hook (setTimeout/clearTimeout in `useEffect`).
  - `app/search/page.tsx` ("use client"):
    - **URL state** via `useSearchParams` + `useRouter` (`replace`, scroll: false): `tab` (`items` | `stalls`, default `items`), `q` (string). Pagination state (`page`) is in-memory only — do NOT mirror to URL.
    - Local input state, debounced 300ms; sync URL when debounced value settles.
    - **Min query length 2.** Below 2 trimmed chars, do NOT fire the API; show the empty-initial state. The debounce hook still runs, the fetch effect just early-returns.
    - **Enter key skips debounce.** `onKeyDown` handler: if `e.key === "Enter"`, immediately set the debounced value to the current input value (or fire fetch directly with current input). Trigger only when length ≥ 2. Bypasses the 300ms wait.
    - **Tab toggle**: two segmented buttons (Items / Stalls). Style identical to the existing condition segmented in `item-form.tsx` — same active-state classes. Active button has bold/primary fill, `aria-pressed="true"`. Switching tabs: reset `page` to 1, re-fetch with the same `q` for the new endpoint.
    - **Search input**: `Input` with `Search` lucide icon prefix + clear `X` button when not empty (`aria-label="Clear search"`, padding `p-2` so target ≥ 44px). Placeholder is **per-tab**: "Search items…" when `tab === "items"`, "Search stalls…" when `tab === "stalls"`. No browser-native validation.
    - **Generation counter** (`genRef`) + `AbortController` per request to drop stale responses, mirroring the homepage pattern in `app/page.tsx`. Both `tab` and `q` changes share the same abort logic.
    - **Pagination**: render first page (20 results) from API. Show a "Load more" button below the result list when `data.totalCount > rendered.length`. Clicking "Load more" bumps `page` and appends results to the existing list. Re-uses the same `q` and `tab`. Resetting `q` or switching tab resets pagination to page 1.
    - **Empty-initial state** (no `q` yet, or `q.trim().length < 2`): centered column with a large muted `Search` lucide icon (~48px, `text-muted-foreground`), heading `t("emptyInitial")` ("Start typing to search"), subtitle `t("emptyInitialDescription")`, and a row of 4 hint chips (`Button variant="outline" size="sm"`) using `t("hints.bicycle")`, `t("hints.watch")`, `t("hints.drill")`, `t("hints.ring")`. Each chip's label IS the search query — clicking it sets `q` to the chip's translated text and fires the search immediately (skip debounce).
    - **Loading state** (fetching): render 6 `ItemCardSkeleton` (items tab) or 6 `PublicStallCardSkeleton` (stalls tab).
    - **Loaded with results**: list of `PublicItemCard` (items) or `PublicStallCard` (stalls). Reuse `ItemDetailModal` + `OffersPopup` like homepage for items tab.
    - **Loaded with 0 results**: empty state ("No items match …" / "No stalls match …") with `Search` icon and `t("noResultsDescription")`.
    - **Error state**: simple text + retry button (`t("errorLoadFailed")`, `t("retry")`).
    - **SEO**: export `metadata` with `robots: { index: false }` so search permutations aren't crawled.
    - Layout: `mx-auto max-w-[600px] px-4 py-6 md:px-6 md:py-8` (matches homepage).
- **Verify:** `cd frontend && npm run build` succeeds; navigate to `/search`, see empty-initial state with icon + chips; tap a chip → fires search immediately; type a 1-char keyword → no fetch; type 2+ chars → debounced fetch fires once after 300ms; press Enter mid-typing → fetch fires immediately; tab toggle re-fetches and resets page; URL updates with `?tab=…&q=…`; reload preserves state; "Load more" appends results; clear button resets to empty state.
- **Parallel:** false
- **Status:** [ ] Pending

### Task 8: Frontend — i18n strings for search page (EN + LV)
- **Files:** `frontend/messages/en.json`, `frontend/messages/lv.json`
- **Action:** Add a `search` namespace to both:
  - `title`
  - `placeholderItems` ("Search items…"), `placeholderStalls` ("Search stalls…")
  - `clearSearch`
  - `tabs.items`, `tabs.stalls`
  - `loading` ("Searching…"), `loadingMore`
  - `loadMore` ("Load more")
  - `emptyInitial` ("Start typing to search"), `emptyInitialDescription` ("Try one of these or type your own")
  - `hints.bicycle`, `hints.watch`, `hints.drill`, `hints.ring` — chip labels that ARE the search query (per-locale; EN: "bicycle, watch, drill, ring"; LV: "velosipēds, pulkstenis, urbis, gredzens")
  - `noResultsItems` ("No items match {q}"), `noResultsStalls` ("No stalls match {q}"), `noResultsDescription` ("Try different keywords")
  - `errorLoadFailed`, `retry`
  - Stall card labels: `itemCount`, `viewStall`
  - LV translations mirror EN keys with Latvian copy ("Meklēt", "Bodes", "Preces", "Sāc rakstīt, lai meklētu", "Nekas nav atrasts", "Mēģini citus atslēgvārdus", "Ielādēt vairāk").
- **Verify:** `cd frontend && npm run build`. All `t("…")` lookups in Task 7 resolve in both locales.
- **Parallel:** true (with Task 6)
- **Status:** [ ] Pending

### Task 9: Frontend — wire sidebar Browse -> /search
- **Files:** `frontend/src/components/app-sidebar.tsx`
- **Action:** Change `{ key: "browse", href: "/browse", icon: Search }` to `{ key: "browse", href: "/search", icon: Search }`. Keep label "Browse" (sidebar icon already `Search`). `isActive` test naturally matches via `pathname.startsWith("/search")`.
- **Verify:** Click "Browse" in sidebar -> lands on `/search`. Active state highlights when on /search.
- **Parallel:** true (independent of all backend tasks once Task 7 page exists)
- **Status:** [ ] Pending

### Task 10: Polish pass — design critique + a11y
- **Files:** any of the above as needed.
- **Action:** Run `web-design-guidelines` skill against `/search` page. Fix any blockers it surfaces: focus states on tab toggle and chips, `aria-pressed` on segmented buttons, `aria-label` on search input + clear button, `role="status"` + `aria-live="polite"` on result count + loading text (announce on both `q` change AND tab switch), semantic `<main>` landmark, mobile tap-target sizes ≥44px, consistent spacing, contrast on placeholder text and on stall card text overlaying user-supplied accent colors. Verify keyboard flow: Tab focuses input -> Enter triggers immediate search -> Tab to clear button -> Tab to tab toggles -> Tab to chips (when empty state) -> Tab to results.
- **Verify:** `cd frontend && npm run build` succeeds. Re-run design critique — no blockers reported. Manual keyboard nav works end to end.
- **Parallel:** false (final code task)
- **Status:** [ ] Pending

### Task 11: Smoke test — full flow
- **Files:** none (manual / curl).
- **Action:** With backend running on :5100 and frontend on :3000:
  1. `curl "http://localhost:5100/api/v1/public/items?q=a&pageSize=3"` → 200 JSON with filtered items (note: client-side enforces min-length 2, but the API accepts any length).
  2. `curl "http://localhost:5100/api/v1/public/items?q=riga"` → matches "Rīga"-titled items via unaccent.
  3. `curl "http://localhost:5100/api/v1/public/stalls?q=a&pageSize=3"` → 200 JSON with filtered stalls.
  4. Open `http://localhost:3000/search` → empty initial state with icon + 4 hint chips.
  5. Tap a hint chip → search fires immediately, results render.
  6. Clear input, type a 1-char keyword → no fetch (verify in Network tab).
  7. Type a 2+ char keyword present in seed data → after 300ms, see skeletons → results.
  8. Press Enter mid-typing → fetch fires without waiting for debounce.
  9. Switch tab to Stalls → results re-fetch with same query, pagination resets.
  10. Click "Load more" → next page appends.
  11. Clear input → returns to initial empty state.
  12. Switch language to Latvian via sidebar More → all search page strings localized; chips show LV labels; chip click fires LV query.
  13. Type query that matches nothing → "no results" empty state with description.
  14. Reload page with `?tab=stalls&q=foo` → state restored, results render.
- **Verify:** All steps pass. `cd frontend && npm run build` and `cd backend && dotnet build ManVaig.sln` both succeed.
- **Parallel:** false
- **Status:** [ ] Pending

## Out of scope (explicit)
- Filters (category, price range, condition, location) — deferred per goal "No filters in this pass."
- Relevance ranking / fuzzy match / typo tolerance — straight ILIKE only.
- Full-text search (tsvector / pg_trgm indexes) — defer until volume warrants. Noted as a follow-up if `unaccent`-on-indexed-column performance becomes an issue.
- Search history / suggestions / autocomplete — not in MVP.
- Public stall detail page — card link target uses existing `/u/{displayName}` profile until a dedicated stall page lands.
- Combined "all" tab — strict two-tab split per goal.
- **Cross-tab fallthrough hint** ("No items match. N stalls match — try Stalls tab →") — deferred to pass 2 with filters; requires a second silent fetch per zero-result render which doubles request count.
- Rate limiting on `/api/v1/public/*` — handled by future API gateway / middleware, not this branch.

## Completion Promise

**NPM RUN BUILD SUCCEEDS AND DOTNET BUILD SUCCEEDS AND SEARCH PAGE RENDERS RESULTS AND DESIGN CRITIQUE RETURNS NO BLOCKERS**

Verify at end of build phase:
1. `cd frontend && npm run build` — exits 0.
2. `cd backend && dotnet build ManVaig.sln` — exits 0, 0 errors.
3. Open `/search`, type a known-matching keyword (≥2 chars), confirm both Items and Stalls tabs render result cards (not just skeletons forever, not error state). Confirm "Load more" works when results exceed one page.
4. Run `web-design-guidelines` skill on `/search` page; report contains zero blocker-severity findings (advisory items acceptable).
