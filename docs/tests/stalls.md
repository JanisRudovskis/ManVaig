# Stall + Item Visibility Test Cases

> Run these when: `Stall` model fields change, `StallVisibility` semantics change, `StallFormDialog` or `VisibilityRadioCards` change, `ItemForm` defaults wiring changes, or on command "test stalls".
>
> Pre-req: backend on `http://localhost:5100`, frontend on `http://localhost:3000`. **Restart `dotnet run` after applying the migration the first time** — file lock + new binary.

## Backend — Visibility cascade (curl smoke)

- [ ] Login as a user with stalls; PUT a NON-default stall to `visibility:3` (Private) via `/api/v1/stalls/{id}`. Anon `curl /api/v1/public/stalls` no longer lists it. Items inside don't appear in `curl /api/v1/public/items`. Anon `GET /api/v1/public/items/{id}` for an item inside → 404. With owner JWT → 200.
- [ ] Set the same stall to `visibility:1` (RegisteredOnly). Anon browse still hidden. Anon item detail → 401. Auth item detail → 200.
- [ ] Set to `visibility:2` (LinkOnly). Anon browse hidden. Anon item detail → 200 (link path works).
- [ ] Set to `visibility:0` (Public). Restored to browse + detail.
- [ ] Try `PUT /api/v1/stalls/{defaultStallId}` with `visibility:3` → 400 with `IS_DEFAULT_REQUIRES_PUBLIC`.
- [ ] POST stall with 11 `defaultTags` → 400 `TAGS_LIMIT`.
- [ ] POST stall with `defaultCategoryId:999999` (nonexistent) → 400 `INVALID_CATEGORY`.
- [ ] After migration, existing stalls show `visibility:0`, all `default*` null/false (no behavior change).

## Backend — Stall defaults round-trip

- [ ] POST `/api/v1/stalls` with all 7 default fields populated → 201 with response showing all fields, including `defaultCategoryName` joined from Category.
- [ ] PUT updates persist all fields; null/false defaults clear them.
- [ ] `GET /api/v1/stalls/{id}` returns the new fields including `defaultCategoryName`.

## Frontend — `/my-stalls` Create flow

- [ ] Click "Create stall" → `StallFormDialog` opens (NOT inline form).
- [ ] First focus = Name input.
- [ ] Visibility section shows 4 vertical radio cards: Public / Registered users only / Link only / Private. Each tappable, ≥44px tall, with icon + label + helper text.
- [ ] Active card has primary fill border + primary tint background.
- [ ] Defaults section starts collapsed; chevron toggles `aria-expanded`.
- [ ] Set name only, save → stall created with Public visibility, no defaults set.
- [ ] Set defaults (category + location + can-ship + tags + condition + accept-offers), save → stall created with values persisted.
- [ ] Validation: empty name shows inline error on blur; >50 char name shows error.
- [ ] Cancel closes without saving. Escape also closes.
- [ ] **List-card inline thumbnail upload still works** (preserved WYSIWYG shortcut on each card — no regression).

## Frontend — `/my-stalls/[id]` Edit flow

- [ ] Click "Edit stall" → `StallFormDialog` opens with values pre-filled.
- [ ] Defaults section starts collapsed; if any defaults are set, header shows `{N} defaults set` badge (ICU plural).
- [ ] Save persists changes; detail page reflects new values.
- [ ] Trying to set `visibility != Public` on the default stall → form-level error `stalls.errors.isDefaultRequiresPublic`.
- [ ] Delete uses existing countdown-confirm dialog (3s/5s).
- [ ] Slug rendered as plain text "Stall URL: yoursite/stalls/{slug}" — NO link affordance (public stall detail page not yet shipped).

## Frontend — Appearance panel on detail page

- [ ] Detail page shows an "Appearance" panel grouping thumbnail + header + background + accent color in one coherent visual section.
- [ ] All upload/crop/delete flows still work end-to-end (no regression from inline-controls refactor).
- [ ] Accent color picker updates the visual rendering immediately.

## Frontend — Wizard with stall defaults

- [ ] Open `/my-stalls/[id]/items/new` for a stall with defaults set.
- [ ] ItemForm pre-fills category, location, canShip toggle, condition, acceptOffers, tags.
- [ ] Visibility defaults to the stall's visibility value (e.g., RegisteredOnly stall → new item starts as RegisteredOnly).
- [ ] "Defaults applied from this stall" hint banner visible above the form.
- [ ] Override category in the form, save → item saved with overridden category (defaults are pre-fills, not constraints).
- [ ] Open the wizard for a stall WITHOUT defaults → no banner; falls back to user-profile location for `location`.

## Frontend — ItemForm visibility parity

- [ ] Visibility section in ItemForm uses identical 4-card vertical layout as `StallFormDialog` (no Select dropdown remaining).
- [ ] Helper text reads slightly differently between modes (`visibility.public.helperStall` vs `helperItem`).
- [ ] Switching visibility updates form state; save persists.
- [ ] Existing item edit path still works without a `stallDefaults` prop (no regression).

## Accessibility (Keyboard + Screen Reader)

- [ ] Dialog tab order: Name → Description → radio group (visibility) → Defaults toggle → Save. Escape closes.
- [ ] Visibility radio cards have `role="radiogroup"`, each card `role="radio"` + `aria-checked`. Arrow keys navigate within group.
- [ ] Form-level errors render in `<div role="alert" aria-live="polite">`.
- [ ] Inline field errors associated with input via `aria-describedby`.
- [ ] Collapsible defaults section: `aria-expanded` + `aria-controls` reflect state.
- [ ] Save button shows `aria-busy="true"` during submit.
- [ ] Tap targets ≥44px on mobile.
- [ ] Lighthouse mobile a11y on `/my-stalls` ≥ 95.

## i18n Coverage (EN + LV)

- [ ] All visibility labels + helpers come from shared `visibility.*` namespace (used by both stall dialog and item form).
- [ ] Stall dialog strings come from `stalls.*` namespace.
- [ ] LV uses correct codebase terminology: stalls = "stendi" (NOT "Bodes"); natural Latvian throughout.
- [ ] No hardcoded English in DOM (grep DevTools snapshot for unexpected strings).
- [ ] ICU plural for defaults badge: `1 default set` / `5 defaults set` (LV equivalents).

## Out of scope (do NOT test in this branch)

- Public stall detail page (`/stalls/[slug]`) — separate cycle, slug rendered as plain text only
- List-card thumbnail upload UX changes — preserved exactly as-is
- Toast/warning when stall change retroactively hides items
- Bulk-apply stall defaults to existing items
- Item-level runtime "inherit from stall" — defaults are pre-fill snapshots only
