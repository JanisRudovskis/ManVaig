# Implementation Plan

## Goal

Frontend Cycle B for the stall + item visibility redesign. Build the popup `StallFormDialog` (replaces inline add/edit), the shared `VisibilityRadioCards` component used by BOTH stall dialog and ItemForm, and an "Appearance" panel on `/my-stalls/[id]` consolidating accent + image management. Wire stall defaults into ItemForm so adding items to a stall pre-fills relevant fields. Cycle A (backend) is merged on master; this cycle consumes the new fields/endpoints.

## Critique-driven UI choices (locked from `design:design-critique` at planning stage)

- **Vertical 4-state radio cards** for visibility (NOT horizontal segmented) — fits LV labels at 375px. Apply identically to ItemForm.
- **Defaults section: always collapsed**; show `{N} defaults set` ICU-plural badge in the header when any are set.
- **Slug = plain text** in dialog (no link affordance) until public stall detail page exists.
- **Accent color + image management OUT of dialog** → consolidated "Appearance" panel on the detail page.
- **List-card thumbnail upload stays exactly as-is** — existing `StallCard` inline upload+crop+delete on `/my-stalls` is good WYSIWYG UX, do NOT touch it.
- **a11y baked**: form-level errors `aria-live="polite"`, inline field errors via `aria-describedby`, collapsible section `aria-expanded` + `aria-controls`, radio cards `role="radiogroup"` + `role="radio"` + `aria-checked`.
- **Defaults grouped into Content** (category, location, tags) **+ Commerce** (condition, ships, accept-offers) with subtle gap.
- **Validate on blur**, not keystroke.
- **Stall-name-taken** → inline error on Name field, not form-level banner.

## Context (from codebase exploration + Cycle A merge)

- **Backend Cycle A is merged on master.** `Stall` now has `Visibility`, `DefaultCategoryId`, `DefaultLocation`, `DefaultCanShip`, `DefaultTagsJson`, `DefaultCondition`, `DefaultAcceptOffers`. `StallVisibility` enum at `Models/Enums/StallVisibility.cs`. `CreateStallRequest`/`UpdateStallRequest`/`StallResponse` all include the new fields. Controllers cascade visibility filtering correctly (smoke-tested end-to-end pre-merge).
- **ItemVisibility states** (already in frontend): Public=0, RegisteredOnly=1, LinkOnly=2, Private=3. **`StallVisibility` uses identical integers.** Single source of i18n copy.
- **Existing inline forms to replace**:
  - Add: `frontend/src/app/my-stalls/page.tsx` lines ~142-178 (Name only today)
  - Edit: `frontend/src/app/my-stalls/[id]/page.tsx` lines ~548-606 (Name + Description today)
- **`StallCard`** in `app/my-stalls/page.tsx` has inline thumbnail upload+crop+delete (`handleFileSelect`, `handleCroppedUpload`, `handleUploadClick`, `handleDeleteThumbnail`). **DO NOT TOUCH.** It's a separate WYSIWYG shortcut and stays.
- **`lib/stalls.ts`** — needs new fields on `StallResponse`, `CreateStallData`, `UpdateStallData`. Add `StallVisibility` enum (object-literal pattern matching whatever items uses) and `StallDefaults` interface (subset for passing to ItemForm). `fetchStall(id)` already exists.
- **`item-form.tsx`** — currently uses a Select dropdown for visibility (4 ItemVisibility states). Replace entirely with the shared `VisibilityRadioCards`. Add `stallDefaults?: StallDefaults` prop; consume defaults for category/location/canShip/condition/acceptOffers/tags/visibility on the "add" path; show "Defaults applied from this stall" hint banner when provided.
- **Reusable**:
  - shadcn `Dialog` from `@base-ui/react`: see `change-email-dialog.tsx`, `change-phone-dialog.tsx`, `confirm-dialog.tsx`
  - `LocationSearch`: `frontend/src/components/location-search.tsx`
  - 5-state Condition segmented + Tag input + Category dropdown — extract or reuse from `item-form.tsx`
  - `confirm-dialog.tsx` countdown for delete (existing pattern)
  - TipsBanner-style info banner: `components/tips-banner.tsx`
- **i18n**:
  - **NEW shared `visibility.*` namespace** for the 4 states (used by stall dialog AND item form). Each state: `.label`, `.helperStall`, `.helperItem` (slightly different copy per mode).
  - Extend `stalls.*` namespace with dialog title/subtitle, section headings, defaults badge ICU plural, sub-group labels (Content/Commerce), default-* field labels, error keys, Appearance panel title.
  - Add `itemForm.stallDefaultsApplied`.
  - Latvian must use natural translation; "stends" not "Bode" (existing convention).

## Tasks

### Task 1: Frontend — `lib/stalls.ts` types + `StallVisibility` enum + `StallDefaults` interface
- **Files:** `frontend/src/lib/stalls.ts`
- **Action:**
  - Match the existing pattern used by `ItemVisibility` in `frontend/src/lib/items.ts` (read it first — likely a TypeScript object-literal `as const` or a TypeScript enum). Mirror that pattern for `StallVisibility = { Public: 0, RegisteredOnly: 1, LinkOnly: 2, Private: 3 }`.
  - Extend the existing `StallResponse` interface: `visibility: number; defaultCategoryId: number | null; defaultCategoryName: string | null; defaultLocation: string | null; defaultCanShip: boolean; defaultTags: string[]; defaultCondition: number | null; defaultAcceptOffers: boolean;`
  - Extend `CreateStallData` (all optional): `visibility?: number; defaultCategoryId?: number | null; defaultLocation?: string; defaultCanShip?: boolean; defaultTags?: string[]; defaultCondition?: number | null; defaultAcceptOffers?: boolean;`
  - Extend `UpdateStallData` (all optional): same as Create.
  - Add new exported `StallDefaults` interface — the subset wizard derives from a fetched stall and passes to ItemForm: `{ categoryId: number | null; location: string | null; canShip: boolean; condition: number | null; acceptOffers: boolean; tags: string[]; visibility: number; }`.
  - `fetchStall(id)` — verify it already exists; if missing, add it (`GET /api/v1/stalls/{id}`, returns `StallResponse`).
- **Verify:** `cd frontend && npx tsc --noEmit` — 0 errors.
- **Parallel:** true (foundation for all subsequent tasks)
- **Status:** [x] Complete

### Task 2: Frontend — new `VisibilityRadioCards` shared component
- **Files:** `frontend/src/components/visibility-radio-cards.tsx` (new)
- **Action:** 4-state vertical radio card component shared between stall dialog and item form.
  ```typescript
  interface VisibilityRadioCardsProps {
    value: number;                        // 0..3 matching StallVisibility/ItemVisibility
    onChange: (value: number) => void;
    mode: "stall" | "item";              // selects helper text variant
    name?: string;                        // for form association
    disabled?: boolean;
  }
  ```
  Layout: 4 stacked cards (Public, RegisteredOnly, LinkOnly, Private). Each card:
  - Whole card is the tap target (≥44px tall). Use `<label>` wrapping `<input type="radio">` for native a11y, OR `role="radio"` + `aria-checked` if styled as buttons (whichever matches the existing item-form Condition segmented pattern — read first).
  - Card content: lucide icon (`Globe` for Public, `Users` for RegisteredOnly, `Link` for LinkOnly, `Lock` for Private) + bold label + helper text below.
  - Active state: `border-primary` + `bg-primary/5` (or whatever the existing segmented active style uses — match for consistency).
  - i18n keys: `visibility.public.label`, `visibility.public.helperStall` / `visibility.public.helperItem` (pick by `mode` prop). Same shape for `registeredOnly`, `linkOnly`, `private`.
  - Container: `role="radiogroup"`, `aria-labelledby` referencing a section heading ID passed by parent.
- **Verify:** `cd frontend && npx tsc --noEmit`. Used by Tasks 3 + 6.
- **Parallel:** true (after Task 1's types land)
- **Status:** [x] Complete

### Task 3: Frontend — `StallFormDialog` component
- **Files:** `frontend/src/components/stall-form-dialog.tsx` (new)
- **Action:** shadcn `Dialog` with `mode: "add" | "edit"`.
  ```typescript
  interface StallFormDialogProps {
    mode: "add" | "edit";
    stall?: StallResponse;          // required for "edit"
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (stall: StallResponse) => void;
  }
  ```
  Sections (top → bottom):
  1. **Header**: `<DialogTitle>` + `<DialogDescription>` (subtitle).
  2. **Identity**: Name (Input, required, 3-50, validate on blur, inline error including server `nameTaken`). Description (Textarea, ≤500, char counter). Edit mode adds read-only "Stall URL: yoursite/stalls/{slug}" as plain text — NO link.
  3. **Visibility**: `<VisibilityRadioCards mode="stall" value={visibility} onChange={setVisibility} />`.
  4. **Defaults** (collapsible):
     - Header: "Item defaults" + chevron + ICU plural badge `{count, plural, one {# default set} other {# defaults set}}` when any non-default value exists.
     - **Always collapsed initially** (both add and edit modes); chevron toggles `aria-expanded` + `aria-controls="defaults-panel"`.
     - When expanded: two sub-groups separated by small gap.
       - **Content**: Default category (Select, all categories + "No default" first option), Default location (`LocationSearch`), Default tags (TagInput, max 10, max 30 chars each).
       - **Commerce**: Default condition (5-state segmented + "No default" reset link below), Items ship by default (Switch), Accept offers by default (Switch).
  5. **Footer (sticky)**: Cancel (ghost, left). Save (primary, right; submitting → spinner + "Saving…" + `aria-busy="true"`). Edit mode adds Delete button (destructive, far left, opens existing `confirm-dialog` with countdown).
  
  **Validation**:
  - Validate on blur per field. Form-level errors → `<div role="alert" aria-live="polite">` above footer.
  - Server `IS_DEFAULT_REQUIRES_PUBLIC` → form-level banner with i18n message `stalls.errors.isDefaultRequiresPublic`.
  - Server `nameTaken` → inline error on Name field.
  - Tags: client-side validate count ≤ 10, each ≤ 30 chars before submit; inline error if exceeded.
  
  **Wiring**:
  - On Save: call `createStall(data)` (add) or `updateStall(stall.id, data)` (edit). On success: `onSaved(updatedStall)` then close.
  - Cancel: close (no unsaved-changes confirm — trust the user).
  - Escape closes (shadcn default). First focus on Name input (shadcn default).
- **Verify:** `cd frontend && npx tsc --noEmit`; `cd frontend && npm run build`. Renders in Tasks 4 + 5.
- **Parallel:** false (depends on Tasks 1, 2)
- **Status:** [ ] Pending

### Task 4: Frontend — wire `/my-stalls/page.tsx` add flow to dialog
- **Files:** `frontend/src/app/my-stalls/page.tsx`
- **Action:**
  - REMOVE the inline create form (lines ~142-178). Replace "Create stall" button's `onClick` with `setStallDialogOpen(true)`.
  - Add `<StallFormDialog mode="add" open={stallDialogOpen} onOpenChange={setStallDialogOpen} onSaved={() => { setStallDialogOpen(false); loadStalls(); }} />`.
  - Remove unused state/functions: `showCreate`, `newName`, `creating`, `createError`, `handleCreate`.
  - **DO NOT TOUCH `StallCard`'s inline thumbnail upload+crop+delete affordance** — it stays exactly as-is.
- **Verify:** `cd frontend && npm run build`. Navigate to `/my-stalls`, click "Create stall" → dialog opens; create with various visibility states → stall appears with correct values; thumbnail upload on cards still works (visual smoke).
- **Parallel:** false (depends on Task 3)
- **Status:** [ ] Pending

### Task 5: Frontend — wire `/my-stalls/[id]/page.tsx` edit flow + extract Appearance panel
- **Files:** `frontend/src/app/my-stalls/[id]/page.tsx`
- **Action:**
  - REMOVE the inline edit drawer (lines ~548-606). Replace "Edit stall" button's `onClick` with `setEditDialogOpen(true)`. Render `<StallFormDialog mode="edit" stall={stall} open={editDialogOpen} onOpenChange={setEditDialogOpen} onSaved={(updated) => { setEditDialogOpen(false); setStall(updated); }} />`.
  - **Extract an "Appearance" panel** that visually groups the existing image controls (thumbnail uploader, header uploader, background uploader) PLUS the accent color picker into one coherent visual section. Title: "Appearance" (i18n: `stalls.appearance.title`). Place immediately after the stall header, before the items grid. Keep the actual upload/crop/delete logic byte-for-byte unchanged — this is purely a visual regrouping.
  - Remove unused inline-edit state/functions: `editName`, `editDescription`, `editing`, `editError`, `handleSaveEdit`, `handleCancelEdit`.
- **Verify:** `cd frontend && npm run build`. Navigate to `/my-stalls/[id]`, click "Edit stall" → dialog opens with values pre-filled; defaults section starts collapsed but shows "{N} defaults set" badge if any are set; Save persists; Appearance panel shows thumbnail+header+background+accent in one coherent group; image uploads still work end-to-end.
- **Parallel:** false (depends on Task 3)
- **Status:** [ ] Pending

### Task 6: Frontend — wizard + ItemForm wiring (defaults + visibility parity)
- **Files:** `frontend/src/app/my-stalls/[id]/items/new/page.tsx`, `frontend/src/components/item-form.tsx`
- **Action:**
  1. **Wizard** (`/my-stalls/[id]/items/new/page.tsx`): fetch the full stall via `fetchStall(id)`. Derive `stallDefaults: StallDefaults` from response: `{ categoryId: stall.defaultCategoryId, location: stall.defaultLocation, canShip: stall.defaultCanShip, condition: stall.defaultCondition, acceptOffers: stall.defaultAcceptOffers, tags: stall.defaultTags, visibility: stall.visibility }`. Pass as `<ItemForm mode="add" stallId={stallId} stallDefaults={stallDefaults} ... />`.
  2. **ItemForm** (`components/item-form.tsx`):
     - Accept new prop `stallDefaults?: StallDefaults`.
     - Use defaults as initial state on the "add" path (only when `stallDefaults` provided AND mode === "add"):
       - `categoryId` ← `stallDefaults?.categoryId ?? 0`
       - `location` ← `stallDefaults?.location ?? userLocation ?? ""` (existing `userLocation` from profile fetch logic stays as fallback)
       - `canShip` ← `stallDefaults?.canShip ?? false`
       - `condition` ← `stallDefaults?.condition ?? Condition.Good`
       - `acceptOffers` ← `stallDefaults?.acceptOffers ?? false`
       - `tags` ← `stallDefaults?.tags ?? []`
       - `visibility` ← `stallDefaults?.visibility ?? ItemVisibility.Public`
     - Show **"Defaults applied from this stall" hint banner** above the form fields when `stallDefaults` is provided AND any default is non-null/non-zero. Style: subtle info banner, match existing TipsBanner pattern (Lightbulb icon, amber tint), but NOT dismissible (it's contextual, goes away when user navigates). i18n key: `itemForm.stallDefaultsApplied`.
     - **Replace the existing visibility Select entirely** with `<VisibilityRadioCards mode="item" value={visibility} onChange={setVisibility} />`. Match the existing form-field layout (label + control). The OLD Select-based visibility UI must be entirely removed; no fallback rendering.
- **Verify:** `cd frontend && npm run build`. Open `/my-stalls/[id]/items/new` for a stall with defaults set → ItemForm pre-fills all the relevant fields + "Defaults applied from this stall" banner visible. Override category in the form, save → item saved with override (defaults are pre-fills, not constraints). Item-form visibility shows the same 4-card vertical layout as stall dialog. Open `/my-items/[id]/edit` (existing item edit) — visibility radio cards work there too without breaking the edit flow.
- **Parallel:** false (depends on Tasks 1, 2)
- **Status:** [ ] Pending

### Task 7: Frontend — i18n keys + final audit
- **Files:** `frontend/messages/en.json`, `frontend/messages/lv.json`, any of the components from Tasks 2-6 as needed.
- **Action:**
  1. **Add i18n keys** (EN + LV; LV uses natural translations, "stends" not "Bode"):
     
     **NEW shared `visibility.*` namespace** (used by stall dialog AND item form):
     - `visibility.public.label`, `.helperStall`, `.helperItem`
     - `visibility.registeredOnly.label`, `.helperStall`, `.helperItem`
     - `visibility.linkOnly.label`, `.helperStall`, `.helperItem`
     - `visibility.private.label`, `.helperStall`, `.helperItem`
     
     **`stalls.*` extensions:**
     - `stalls.dialogAddTitle`, `stalls.dialogAddSubtitle`
     - `stalls.dialogEditTitle`, `stalls.dialogEditSubtitle`
     - `stalls.identitySection`, `stalls.visibilitySection`, `stalls.defaultsSection`
     - `stalls.defaultsBadge` — ICU plural: `{count, plural, one {# default set} other {# defaults set}}`
     - `stalls.defaultsContent`, `stalls.defaultsCommerce`
     - `stalls.defaultCategory`, `stalls.defaultCategoryNone`
     - `stalls.defaultLocation`, `stalls.defaultLocationPlaceholder`
     - `stalls.defaultTags`, `stalls.defaultTagsPlaceholder`
     - `stalls.defaultCondition`, `stalls.defaultConditionNone`
     - `stalls.defaultCanShip`, `stalls.defaultAcceptOffers`
     - `stalls.appearance.title`
     - `stalls.stallUrlLabel`
     - `stalls.errors.isDefaultRequiresPublic`, `stalls.errors.nameTaken`, `stalls.errors.tagsLimit`, `stalls.errors.invalidCategory`
     
     **`itemForm.*` extension:**
     - `itemForm.stallDefaultsApplied` ("Defaults applied from this stall" / Latvian equivalent)
  
  2. **Audit `StallFormDialog` via `design:design-critique` skill:**
     - Invoke skill with the implemented dialog source files + describe state.
     - Categorize: BLOCKER (fix this iteration) vs NICE-TO-HAVE (append to `.ralph/learnings.md` under "Signs", do NOT fix).
     - Loop until 0 BLOCKERs (max 3 cycles per AGENTS.md rules).
  
  3. **Lighthouse a11y** on `/my-stalls` via chrome-devtools-mcp — score ≥ 95. Fix blockers.
  
  4. **Keyboard nav check** on dialog: Tab through Name → Description → radio group → defaults toggle → Save. Escape closes. Enter on Save submits.
- **Verify:** `cd frontend && npm run build` succeeds. design-critique returns 0 blockers. Lighthouse a11y ≥ 95 on `/my-stalls`. Keyboard nav works.
- **Parallel:** false (final task)
- **Status:** [ ] Pending

## Out of scope (this cycle)

- **Backend changes** (`backend/**`) — completely off-limits, Cycle A is merged
- Public stall detail page (`/stalls/[slug]`) — separate cycle; slug shown as plain text only
- **List-card thumbnail upload UI changes** — preserved exactly as-is on `StallCard`
- iOS safe-area-inset on sticky footer (global polish pass, not this cycle)
- Cancel-with-unsaved-changes confirm — skip, trust user
- Optimistic UI on save — block during save instead, simpler
- Toast/warning when stall change hides items
- Bulk-apply stall defaults to existing items
- Doc updates (ROADMAP.html, ARCHITECTURE.md, etc.) — separate ask

## Completion Promise

**NPM RUN BUILD SUCCEEDS AND STALL DIALOG REPLACES INLINE FORMS AND ITEM FORM USES SAME VISIBILITY CARDS AND DESIGN CRITIQUE RETURNS NO BLOCKERS**

Verify at end of build phase:
1. `cd frontend && npm run build` — exits 0
2. `/my-stalls` "Create stall" opens the new Dialog (NOT the inline form)
3. `/my-stalls/[id]` "Edit stall" opens the same Dialog (with values pre-filled)
4. Detail page has an "Appearance" panel grouping thumbnail + header + background + accent
5. List-card inline thumbnail upload still works (existing UX preserved)
6. Wizard `/my-stalls/[id]/items/new` for a stall with defaults: ItemForm pre-fills + shows "Defaults applied from this stall" banner
7. ItemForm's visibility uses identical 4-card vertical layout as stall dialog
8. `design:design-critique` skill on `StallFormDialog` post-implementation: 0 blockers
