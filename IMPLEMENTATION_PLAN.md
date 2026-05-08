# Implementation Plan

## Goal
Build a `/people` page (people directory) where any visitor can search for users by display name, click a result card, and land on the existing `/user/[displayName]` profile. MVP: text search by displayName only, mobile-first, EN+LV i18n, debounced input (300ms), min 2 chars, empty-initial state with hint, "Active N ago" label sourced from existing `LastSeenAt` field. No new sidebar item — entry point is at the top of the existing sidebar More menu. No filters.

## Privacy contract (load-bearing — read carefully)

- `ApplicationUser.IsProfilePublic` defaults `true`. Recent commit added private-profile visibility.
- **Anonymous viewer:** only `IsActive == true AND IsProfilePublic == true` users appear in `/api/v1/public/users` results. Private users are completely invisible to anonymous searchers.
- **Authenticated viewer:** sees all `IsActive == true` users (public + private), full card.
- Rule of thumb: **if a user is visible at all in the result set, ALL fields on the card are shown** (avatar, displayName, memberSince, last-seen, contact-method icons). Don't invent partial cards.

## Context (from codebase exploration)

- **`ApplicationUser`** (`backend/ManVaig.Api/Models/ApplicationUser.cs`) has: `DisplayName` (3–30 chars, regex `^[a-zA-Z0-9_-]{3,30}$` — **no diacritics, no spaces**, so no `unaccent` needed for this search), `AvatarUrl`, `Bio`, `Location`, `Phone`, `TelegramUsername`, `IsProfilePublic` (bool, default true), `EnabledChannels` (flags: WhatsApp=1, Telegram=2, ShowEmail=4, ShowPhone=8), `IsActive` (bool), `CreatedAt`, `LastSeenAt` (nullable, populated by `LastSeenMiddleware` with 5-minute throttle), `EmailConfirmed` (Identity-managed).
- **DisplayName uniqueness** is enforced at registration via case-insensitive `AnyAsync` check in `AuthController.Register`. There is no DB unique index, but in practice every register check enforces it. Safe to use `displayName` as a key in URLs.
- **Existing public controllers** to mirror: `backend/ManVaig.Api/Controllers/V1/PublicItemsController.cs` and `backend/ManVaig.Api/Controllers/V1/PublicStallsController.cs`. Both are anonymous, paginated (`page`, `pageSize`), accept `?q=`, return `{ Items|Stalls, TotalCount, Page, PageSize }`. Stalls controller filters out private content (only stalls with at least one public item) — same shape applies to user privacy here.
- **DTO file convention:** `backend/ManVaig.Api/Models/Dto/PublicItemDtos.cs` exists. Add `PublicUserDtos.cs` alongside (do NOT cram into `ProfileDtos.cs` — different concern).
- **Frontend search shell to mirror:** `frontend/src/app/search/search-client.tsx` is the canonical pattern. It has: debounced input (300ms via `lib/use-debounced-value.ts`), URL state via `useSearchParams` + `replace` + `scroll: false`, min query length 2, `Enter` skips debounce, generation counter + `AbortController` for race safety, pagination ("Load more" appends), `role="status"` + `aria-live="polite"` live region with ICU plurals, empty-initial state with hint chip(s), error/retry, skeletons. Copy the structure directly — do not reinvent.
- **`fetchPublicStalls`** in `frontend/src/lib/stalls.ts` is the call-pattern. Plain `fetch` (not `authFetch`), URLSearchParams append, returns typed list response.
- **`PublicStallCard`** (`frontend/src/components/public-stall-card.tsx`) is the card pattern: same `rounded-xl`, same border, mobile-first, skeleton variant exported alongside.
- **`UserAvatar`** (`frontend/src/components/user-avatar.tsx`) handles avatar + initials fallback. Reuse it on the card.
- **Sidebar More menu** lives at `frontend/src/components/sidebar-more-menu.tsx`. Current order: Theme / Language / Listing tips / (sep) / Logout. Add "Find people" at the very top (above Theme), with `Users` lucide icon. Click → close popover + `router.push("/people")`.
- **i18n:** namespaces under `frontend/messages/{en,lv}.json`. Add a new top-level `people.*` namespace, plus one new key `nav.findPeople` for the More menu entry. Latvian terminology is "stendi" for stalls already established — keep "cilvēki" (people) consistent with that natural-language style.
- **Last-active label format:** use `next-intl`'s `useFormatter().relativeTime(date, now)` — handles all unit bucketing (minutes / hours / days / weeks / months) and i18n automatically. Wrap in a tiny `useRelativeTime()` hook in `frontend/src/lib/use-relative-time.ts` that returns `t("activeAgo", { time })` or `t("activeNever")` if `LastSeenAt` is null.
- **Routing:** `/user/[displayName]` already exists (handled by `ProfileController.GetPublicProfile`). Card click links there directly.

## Tasks

### Task 1: Backend — add `PublicUserCardDto` + `PublicUserListResponse` DTOs
- **Files:** `backend/ManVaig.Api/Models/Dto/PublicUserDtos.cs` (new)
- **Action:** Create new file with two classes:
  ```csharp
  public class PublicUserCardDto
  {
      public string DisplayName { get; set; } = "";
      public string? AvatarUrl { get; set; }
      public DateTime MemberSince { get; set; }
      public DateTime? LastSeenAt { get; set; }
      public bool HasWhatsApp { get; set; }
      public bool HasTelegram { get; set; }
      public bool HasPhone { get; set; }
      public bool HasEmail { get; set; }
  }

  public class PublicUserListResponse
  {
      public List<PublicUserCardDto> Users { get; set; } = new();
      public int TotalCount { get; set; }
      public int Page { get; set; }
      public int PageSize { get; set; }
  }
  ```
  Namespace `ManVaig.Api.Models.Dto`. Mirror naming convention of `PublicStallListResponse` in `StallDtos.cs`.
- **Verify:** `cd backend && dotnet build ManVaig.sln` — 0 errors.
- **Parallel:** true (independent of all others)
- **Status:** [x] Complete

### Task 2: Backend — create `PublicUsersController` with browse + search + privacy filter
- **Files:** `backend/ManVaig.Api/Controllers/V1/PublicUsersController.cs` (new)
- **Action:** New controller `[Route("api/v1/public/users")] [ApiController]`, action `[HttpGet] Browse([FromQuery] int page = 1, int pageSize = 20, string? q = null)`. Mirror the shape of `PublicStallsController.Browse`. Logic:
  - `page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 50);`
  - Base query: `_db.Users.Where(u => u.IsActive)`.
  - **Privacy filter:** if `User.Identity?.IsAuthenticated != true`, also `Where(u => u.IsProfilePublic)`. Anonymous viewers never see private users.
  - When `q` is non-null/non-whitespace: trim, cap at 100 chars, `var pattern = $"%{trimmed}%"`. Apply `.Where(u => u.DisplayName != null && EF.Functions.ILike(u.DisplayName, pattern))`. **No `EF.Functions.Unaccent` needed** — DisplayName regex already excludes diacritics.
  - Sort: `OrderByDescending(u => u.LastSeenAt.HasValue).ThenByDescending(u => u.LastSeenAt).ThenByDescending(u => u.CreatedAt)` — most recently active first, never-seen users at the bottom.
  - Project to `PublicUserCardDto`. Compute `Has*` flags inline:
    - `HasEmail = (u.EnabledChannels & CommunicationChannels.ShowEmail) != 0 && u.EmailConfirmed`
    - `HasPhone = (u.EnabledChannels & CommunicationChannels.ShowPhone) != 0 && u.Phone != null && u.Phone != ""`
    - `HasWhatsApp = (u.EnabledChannels & CommunicationChannels.ShowPhone) != 0 && (u.EnabledChannels & CommunicationChannels.WhatsApp) != 0 && u.Phone != null && u.Phone != ""`
    - `HasTelegram = (u.EnabledChannels & CommunicationChannels.Telegram) != 0 && u.TelegramUsername != null && u.TelegramUsername != ""`
  - Return `Ok(new PublicUserListResponse { Users = users, TotalCount = totalCount, Page = page, PageSize = pageSize })`.
- **Verify:** `cd backend && dotnet build ManVaig.sln`. After API restart: `curl "http://localhost:5100/api/v1/public/users?q=cak&pageSize=5"` returns 200 JSON; should include the seed user "Čaks" (display name `Caks` — verify exact casing). `curl "http://localhost:5100/api/v1/public/users?q=ABC123XYZ"` returns 200 with `users: []`, `totalCount: 0`.
- **Parallel:** false (depends on Task 1)
- **Status:** [x] Complete

### Task 3: Frontend — `lib/users.ts` with `fetchPublicUsers`
- **Files:** `frontend/src/lib/users.ts` (new)
- **Action:** Mirror `lib/stalls.ts` `fetchPublicStalls`. Export:
  ```typescript
  export interface PublicUserCard {
    displayName: string;
    avatarUrl: string | null;
    memberSince: string;       // ISO date
    lastSeenAt: string | null; // ISO date
    hasWhatsApp: boolean;
    hasTelegram: boolean;
    hasPhone: boolean;
    hasEmail: boolean;
  }
  export interface PublicUserListResponse {
    users: PublicUserCard[];
    totalCount: number;
    page: number;
    pageSize: number;
  }
  export async function fetchPublicUsers(opts: {
    page?: number; pageSize?: number; q?: string; signal?: AbortSignal;
  }): Promise<PublicUserListResponse> { ... }
  ```
  Use plain `fetch` (no `authFetch`). Build URLSearchParams; only append `q` when truthy and trimmed. API base URL same as other lib files (`process.env.NEXT_PUBLIC_API_URL`).
- **Verify:** `cd frontend && npx tsc --noEmit` — 0 errors.
- **Parallel:** true (independent)
- **Status:** [ ] Pending

### Task 4: Frontend — `useRelativeTime` hook for "Active N ago" labels
- **Files:** `frontend/src/lib/use-relative-time.ts` (new)
- **Action:** Tiny hook combining `next-intl`'s formatter with i18n strings:
  ```typescript
  "use client";
  import { useFormatter, useTranslations } from "next-intl";
  export function useRelativeTime() {
    const format = useFormatter();
    const t = useTranslations("people");
    return (date: Date | string | null | undefined): string => {
      if (!date) return t("activeNever");
      const d = typeof date === "string" ? new Date(date) : date;
      return t("activeAgo", { time: format.relativeTime(d, new Date()) });
    };
  }
  ```
  `format.relativeTime` returns localized strings like "5 minutes ago" / "pirms 5 minūtēm" — i18n is free.
- **Verify:** `cd frontend && npx tsc --noEmit`.
- **Parallel:** true (independent)
- **Status:** [ ] Pending

### Task 5: Frontend — `PublicUserCard` component + skeleton variant
- **Files:** `frontend/src/components/public-user-card.tsx` (new)
- **Action:** Mobile-first card. Visual primitives MUST match `PublicStallCard` (`rounded-xl`, `border`, comparable shadow + height) so the design system stays coherent. Layout:
  - `next/link` to `/user/{displayName}` wraps the whole card (block-level link). `aria-label` describes the destination.
  - Top row: `UserAvatar` (size `md`, reuse `frontend/src/components/user-avatar.tsx`) + displayName (`font-semibold`, truncate).
  - Second row (small, muted): `t("memberSinceShort", { year })` where `year = new Date(memberSince).getFullYear()`.
  - Third row (small, muted): `useRelativeTime()` formatter applied to `lastSeenAt`.
  - Fourth row: contact-method icon strip — show small lucide icons (`MessageCircle` for WhatsApp, `Send` for Telegram, `Phone`, `Mail`) ONLY for the channels where the corresponding `has*` boolean is true. Each icon needs an `aria-label` from i18n. If all four are false, hide the row entirely (no empty placeholder).
  - Hover/focus state matches stall card (subtle bg shift).
- Export `PublicUserCardSkeleton` alongside (avatar circle + 3 text lines). Match height of the real card.
- **Verify:** `cd frontend && npx tsc --noEmit`. Renders on `/people` in Task 6.
- **Parallel:** true (does not block Tasks 1–4)
- **Status:** [ ] Pending

### Task 6: Frontend — `/people` page (server wrapper + client)
- **Files:** `frontend/src/app/people/page.tsx` (new server-page wrapper), `frontend/src/app/people/people-client.tsx` (new client component)
- **Action:**
  - **Server page** (`page.tsx`): export `metadata` with `robots: { index: false }` and `title` from `t("people.title")` (use `getTranslations` for server-side i18n on metadata). Body: `<Suspense fallback={null}><PeopleClient /></Suspense>`. Suspense is required because `PeopleClient` calls `useSearchParams`.
  - **Client** (`people-client.tsx`, `"use client"`): copy the structure of `frontend/src/app/search/search-client.tsx` and trim to a single tab (no Items/Stalls toggle). Specifically:
    - URL state via `useSearchParams` + `useRouter` (`replace`, `scroll: false`): `q` only.
    - Local input state, debounced 300ms via `useDebouncedValue`.
    - **Min query length 2.** Below that, do not fire the API; show empty-initial state.
    - **Enter skips debounce.** `onKeyDown`: if `e.key === "Enter"` and trimmed length ≥ 2, fire fetch immediately.
    - Search input: shadcn `Input` with `Search` lucide icon prefix + clear `X` button when value present. Placeholder = `t("placeholder")`. Clear button has `aria-label={t("clearSearch")}` and tap target ≥ 44px (use `p-2`). **No browser-native validation** (no `required`/`minLength`).
    - `genRef` (incrementing number) + `AbortController` per fetch — drop stale responses by comparing `gen === currentGen.current` after `await`.
    - Pagination: 20/page; show "Load more" button when `data.totalCount > rendered.length`. Click bumps `page`, appends results. Reset page to 1 whenever `q` changes.
    - **Live region:** `<div role="status" aria-live="polite" className="sr-only">{...}</div>` announcing the count via ICU plural — use `t("liveCount", { count: totalCount })` — only when `queryReady && totalCount >= 0` and not loading/erroring. On zero results, the empty state heading already announces; do NOT also push a zero-count live announcement (matches `search-client` style).
    - **Empty-initial state** (`q.trim().length < 2`): centered column, large muted `Users` lucide icon (~48px), heading `t("emptyInitial")`, subtitle `t("emptyInitialDescription")`. No hint chips on this page (different intent than `/search` — users come here with a name in mind).
    - **Loading state:** 6 `PublicUserCardSkeleton` in a single column.
    - **Loaded with results:** list of `PublicUserCard` (single column, `gap-3`).
    - **Loaded with 0 results:** centered, `Users` icon, `t("noResults", { q })`, `t("noResultsDescription")`.
    - **Error state:** `t("errorLoadFailed")` + retry button (`t("retry")`).
    - Layout container: `<main className="mx-auto max-w-[600px] px-4 py-6 md:px-6 md:py-8">` — matches `/search`.
    - Page heading: `<h1>` with `t("title")`, mobile-tight margins.
- **Verify:** `cd frontend && npm run build` — 0 errors. Navigate to `/people`: empty-initial state renders. Type `ca` (1 char `c`, then `a`) — **no fetch on `c`, fetch fires once 300ms after `a` lands**. Press Enter mid-typing — fires immediately. Reload `/people?q=cak` — state restored, results render. Network tab shows `/api/v1/public/users?q=cak&page=1&pageSize=20` (or similar). Click a result card → lands on `/user/[displayName]` profile page.
- **Parallel:** false (depends on Tasks 3, 4, 5)
- **Status:** [ ] Pending

### Task 7: Frontend — add "Find people" entry to sidebar More menu
- **Files:** `frontend/src/components/sidebar-more-menu.tsx`, `frontend/messages/en.json`, `frontend/messages/lv.json`
- **Action:** In `sidebar-more-menu.tsx`, in the `view === "main"` block, add a new button as the FIRST entry (above the theme toggle):
  ```tsx
  <button
    onClick={() => { setOpen(false); router.push("/people"); }}
    className={btnClass}
  >
    <Users className="size-4 shrink-0" />
    <span className="flex-1 text-left">{t("findPeople")}</span>
  </button>
  ```
  Import `Users` from `lucide-react` (already imports other lucide icons in this file). The `t` for `nav` is already in scope. Add `nav.findPeople` to BOTH `en.json` ("Find people") and `lv.json` ("Atrast cilvēkus").
- **Verify:** Open sidebar → click hamburger ("More") → popover opens → "Find people" is the first entry, with the Users icon. Click → popover closes, navigates to `/people`. Switch language to LV → entry shows "Atrast cilvēkus".
- **Parallel:** false (depends on Task 6 page existing for the click target to resolve)
- **Status:** [ ] Pending

### Task 8: Frontend — add `people.*` i18n strings (EN + LV)
- **Files:** `frontend/messages/en.json`, `frontend/messages/lv.json`
- **Action:** Add a top-level `people` namespace to BOTH locale files. Required keys (and their EN values; LV must mirror with natural Latvian, using "cilvēki" for "people"):
  - `title` — "People" / "Cilvēki"
  - `placeholder` — "Search people…" / "Meklēt cilvēkus…"
  - `clearSearch` — "Clear search" / "Notīrīt meklēšanu"
  - `loading` — "Searching…" / "Meklē…"
  - `loadMore` — "Load more" / "Ielādēt vairāk"
  - `emptyInitial` — "Find people" / "Atrast cilvēkus"
  - `emptyInitialDescription` — "Type a username to find someone" / "Ieraksti lietotājvārdu, lai kādu atrastu"
  - `noResults` — "No people match {q}" / "Nav atrasts neviens cilvēks ar {q}"
  - `noResultsDescription` — "Try a different username" / "Mēģini citu lietotājvārdu"
  - `errorLoadFailed` — "Couldn't load people" / "Neizdevās ielādēt cilvēkus"
  - `retry` — "Try again" / "Mēģināt vēlreiz"
  - `liveCount` — ICU plural: `{count, plural, one {# person matches} other {# people match}}` / `{count, plural, one {# cilvēks atbilst} other {# cilvēki atbilst}}`
  - `memberSinceShort` — "Member since {year}" / "Reģistrējies {year}"
  - `activeNever` — "Never seen" / "Nav redzēts"
  - `activeAgo` — "Active {time}" / "Aktīvs {time}"
  - `contactWhatsApp` — "WhatsApp available" / "Pieejams WhatsApp"
  - `contactTelegram` — "Telegram available" / "Pieejams Telegram"
  - `contactPhone` — "Phone available" / "Pieejams tālrunis"
  - `contactEmail` — "Email available" / "Pieejams e-pasts"
- **Verify:** `cd frontend && npm run build`. Every `t("people.*")` lookup in Tasks 4, 5, 6 resolves in BOTH locales. Switch locale via sidebar More → all `/people` strings localize.
- **Parallel:** true (does not block Task 6 functionally — TS won't fail on missing i18n keys, only runtime would; do this before Task 6's verify)
- **Status:** [ ] Pending

### Task 9: Polish + design audit
- **Files:** any of the above as needed.
- **Action:** Invoke `design:design-critique` skill via Skill tool on the `/people` page implementation (pass `app/people/page.tsx`, `app/people/people-client.tsx`, `components/public-user-card.tsx`, `lib/use-relative-time.ts`, the new i18n keys, and the More menu change). Categorize findings:
  - **BLOCKER:** mobile responsiveness break, missing aria/semantic HTML, hardcoded strings, broken focus order, contact icons without aria-label, tap targets < 44px, missing live region, unguarded null on `lastSeenAt` causing render crash, contrast failure on muted text. Fix all.
  - **NICE-TO-HAVE:** polish suggestions, animation, copy tweaks, follow-on cleanup. Append to `.ralph/learnings.md` under "Signs"; do NOT fix in this iteration.
  Re-invoke skill after fixes; loop until no blockers (max 3 cycles per the prompt rules). If still blocking after 3 cycles, append to "Known Issues" and proceed.
  Verify keyboard flow manually: Tab from sidebar → page heading → search input → clear button (when present) → result cards. Focus rings visible at every step.
- **Verify:** `cd frontend && npm run build` succeeds. `cd backend && dotnet build ManVaig.sln` succeeds. Re-running design-critique returns zero blockers.
- **Parallel:** false (final code task)
- **Status:** [ ] Pending

## Out of scope (explicit)
- Online presence (heartbeat / websocket / 5-min "online now" dot) — `LastSeenAt` is sufficient. Real-time presence deferred to a future cycle.
- Filters by location, has-stall, member-since range — keep search query-only.
- Default browse feed when `q` is empty — empty state is intentional per design decision.
- New sidebar nav item — kept in More menu by design.
- In-app messaging — out of scope for ManVaig entirely; contact happens via existing WhatsApp/Telegram/Phone links on the profile page.
- DB unique index on `DisplayName` — left as-is; soft-uniqueness via register-time check is sufficient for v1. Revisit if collision races become an issue.
- Tag/category surfacing on user cards — not in scope; user search is name-only.
- Pagination URL state for `page` — kept in-memory only (matches `/search`).
- Public stall detail link from card — card always links to `/user/[displayName]`, never to a specific stall.

## Completion Promise

**NPM RUN BUILD SUCCEEDS AND DOTNET BUILD SUCCEEDS AND PEOPLE PAGE RENDERS RESULTS AND DESIGN CRITIQUE RETURNS NO BLOCKERS**

Verify at end of build phase:
1. `cd frontend && npm run build` — exits 0.
2. `cd backend && dotnet build ManVaig.sln` — exits 0, 0 errors.
3. Open `/people`, type a known displayName (≥2 chars, e.g. `cak`), confirm result cards render with avatar, displayName, memberSince, last-active, contact icons (where applicable). Click a card → lands on `/user/[displayName]` profile.
4. Run `design:design-critique` skill on `/people` page; report contains zero blocker-severity findings.
