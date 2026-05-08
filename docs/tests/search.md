# Search Test Cases

> Run these when: `/search` page changes, public browse endpoints change, debounce/i18n tweaks, or on command "test search"
>
> Pre-req: backend on `http://localhost:5100`, frontend on `http://localhost:3000`. **If you've added a new public controller / changed migrations and the API was running during build, restart `dotnet run` to clear the file lock and pick up the new binary.**

## Empty Initial State

- [ ] Navigate to `/search` (or click "Browse" in sidebar) → page loads with title "Search"
- [ ] Tab toggle visible (Items selected by default), search input below, both full-width on mobile
- [ ] Empty state shows: large muted Search icon, "Start typing to search" heading, subtitle, 4 hint chips (bicycle / watch / drill / ring)
- [ ] No network call to `/api/v1/public/items` or `/stalls` on initial load (verify in DevTools Network)
- [ ] Sidebar "Browse" item is highlighted as active

## Hint Chips

- [ ] Tap a chip (e.g. "bicycle") → input fills with "bicycle", search fires immediately (no 300ms wait)
- [ ] Switch to LV locale via sidebar More → chips show Latvian labels (velosipēds / pulkstenis / urbis / gredzens)
- [ ] Tap LV chip → query fires with the LV text (e.g. `q=velosipēds`)

## Debounce + Min Query Length

- [ ] Type a single character (e.g. `a`) → no API call fires (verify in Network)
- [ ] Type a second character → after 300ms idle, exactly ONE API call fires (debounce works)
- [ ] Type rapidly 5 characters in <300ms → still only ONE call after settling
- [ ] Press Enter mid-typing (after ≥2 chars) → call fires immediately, bypasses the 300ms wait
- [ ] URL updates with `?q=…` after each settled debounce

## Diacritic Folding (Latvian)

- [ ] Type `fikseta` (no diacritics) → matches item titled "Fiksēta cena" (with ē)
- [ ] Type `riga` → matches stall/item containing "Rīga" in name/description/owner display name
- [ ] Capitalization is irrelevant (`FIKSETA` matches `Fiksēta`)

## Items Tab

- [ ] Search returns matching items as `PublicItemCard` grid
- [ ] Each card: image carousel, title, price, location pill, time-ago, bid count badge if applicable
- [ ] Click card opens `ItemDetailModal` (same as homepage feed)
- [ ] Live region (sr-only) announces "N items match" / "1 item matches" with correct singular/plural

## Stalls Tab

- [ ] Switch to Stalls tab → URL updates to `?tab=stalls&q=…`, results re-fetch
- [ ] Pagination resets to page 1 on tab switch
- [ ] Stall cards render: header strip (header image OR accent gradient with text-on-color guard), avatar, name, owner row, item-count badge, preview thumbnails
- [ ] Preview thumbnails: max 3 on `< sm:` (~640px), max 4 from `sm:` upward
- [ ] Click stall card → navigates to `/user/{displayName}` (current placeholder until public stall page lands)
- [ ] Live region announces "N stalls match" / "1 stall matches"

## Pagination (Load More)

- [ ] When results > 20, "Load more" button appears below the list
- [ ] Click "Load more" → next page fetches (`?page=2`), results append (don't replace)
- [ ] When all results loaded, button disappears
- [ ] Switching tabs or changing query resets pagination to page 1

## States

- [ ] **Loading**: 6 skeletons render (item-shaped on Items tab, stall-shaped on Stalls tab)
- [ ] **No results**: heading "No items match {q}" / "No stalls match {q}" + "Try different keywords" subtitle
- [ ] **Error**: stop the backend, type a query → error banner with "Try again" button. Restart backend, click Try again → recovers.
- [ ] Clear button (`X`) appears when input has value, clears query and returns to empty initial state

## URL State / Navigation

- [ ] Reload `?tab=stalls&q=ring` → state restored, results render automatically
- [ ] Browser back/forward navigates through prior `q` / `tab` values
- [ ] URL change uses `replace` + `scroll: false` (no scroll jump on each keystroke)

## Accessibility (Keyboard + Screen Reader)

- [ ] Tab order: sidebar nav → page heading → tab toggle (Items/Stalls) → search input → clear button (when present) → hint chips (when empty state) → results
- [ ] Tab toggle uses `role="tab"` + `aria-selected` (NOT `aria-pressed` — they don't combine; ESLint `jsx-a11y/role-supports-aria-props`)
- [ ] Active tab visually distinct (bold + primary fill)
- [ ] Search input has visible focus ring
- [ ] Clear button has `aria-label="Clear search"`, target ≥44px (uses `p-2`)
- [ ] No browser-native validation (`required`, `minLength`, `type="email"`)
- [ ] Live region (`role="status"` + `aria-live="polite"`) announces result count on every settled query and tab switch
- [ ] Lighthouse mobile a11y audit returns 100

## i18n Coverage (EN + LV)

- [ ] Every visible string toggles when locale switches via sidebar More
- [ ] Per-tab placeholder swaps (`Search items…` ↔ `Search stalls…` / `Meklēt preces…` ↔ `Meklēt stendus…`)
- [ ] Plural messages use ICU plurals: `1 item matches` / `5 items match`, `1 stall matches` / `5 stalls match`
- [ ] LV uses correct codebase terminology: stalls = "stendi" (NOT "Bodes")
- [ ] No hardcoded English in DOM (grep DevTools snapshot for unexpected English)

## SEO

- [ ] View page source → `<meta name="robots" content="noindex" />` present
- [ ] Lighthouse SEO is intentionally <100 because of the noindex (this is correct, NOT a bug)

## Backend (curl smoke)

- [ ] `curl "http://localhost:5100/api/v1/public/items?q=fikseta&pageSize=2"` → 200 JSON with `Fiksēta cena` item
- [ ] `curl "http://localhost:5100/api/v1/public/stalls?q=ja&pageSize=3"` → 200 JSON with at least one stall
- [ ] `curl "http://localhost:5100/api/v1/public/items?q=ABC123XYZ"` → 200 JSON with `items: []`, `totalCount: 0`
- [ ] `curl "http://localhost:5100/api/v1/public/items"` (no q) → returns latest items (no filter)
- [ ] `psql` → `SELECT extname FROM pg_extension WHERE extname = 'unaccent';` returns one row

## Out of scope (do NOT test in this branch)

- Filters (price/condition/location/category facets) — pass 2
- Cross-tab fallthrough hint ("No items match. N stalls match → try Stalls tab") — pass 2
- Search history / suggestions / autocomplete — future
- Public stall detail page (currently links to `/user/{displayName}`) — future
- Rate limiting on public endpoints — future API gateway concern
