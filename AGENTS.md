# AGENTS.md — Ralph Operational Guide

Read this every iteration. It overrides any default assumptions Ralph might make from the codebase scan.

## Build / Run / Lint

| What | Command |
|---|---|
| Frontend dev | `cd frontend && npm run dev` (port 3000) |
| Frontend build | `cd frontend && npm run build` |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend type-check | `cd frontend && npx tsc --noEmit` |

This cycle is **FRONTEND-ONLY**. Do NOT touch `backend/**`. The backend (Cycle A) is already merged on master.

There is NO unit test framework. Do NOT install Vitest/Jest. This branch does not require new tests.

## Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui (`@base-ui/react`), `next-intl`, `next-themes`, `lucide-react`

## Non-negotiable conventions

- **Mobile-first.** Default Tailwind classes target mobile; use `sm:`, `md:`, `lg:` only to upscale.
- **i18n.** Every user-facing string via `next-intl` (`useTranslations(...)`). Add keys to BOTH `frontend/messages/en.json` AND `frontend/messages/lv.json`. Never hardcode strings. Latvian uses natural translations — "stends" not "Bode".
- **No browser-native validation.** Never use `required`, `minLength`, `type="email"`.
- **shadcn/ui only** for primitives. Don't introduce new UI libraries.
- **No tests** unless explicitly asked. **No doc updates** unless explicitly asked.

## Reuse — these patterns already exist

| Need | Use |
|---|---|
| Modal dialog + sticky footer | `components/change-email-dialog.tsx`, `components/change-phone-dialog.tsx` |
| Confirm with countdown | `components/confirm-dialog.tsx` (used by ItemForm delete) |
| Location autocomplete | `components/location-search.tsx` |
| Tag input + Category dropdown | extract from `components/item-form.tsx` |
| 5-state Condition segmented | from `components/item-form.tsx` |
| Info banner pattern | `components/tips-banner.tsx` (Lightbulb icon, amber tint) |
| Avatar + initials fallback | `components/user-avatar.tsx` |
| Existing list-card thumbnail upload | `app/my-stalls/page.tsx` `StallCard` component (DO NOT MODIFY — preserves WYSIWYG UX) |
| Existing inline edit drawer | `app/my-stalls/[id]/page.tsx` ~lines 548-606 (REPLACE with dialog) |
| Existing inline create form | `app/my-stalls/page.tsx` ~lines 142-178 (REPLACE with dialog) |

## Critique-driven UI rules (locked from `design:design-critique` at planning stage)

- **Vertical 4-state radio cards** for visibility, NOT horizontal segmented. Each card = full-row tappable label + helper text. Apply same pattern to ItemForm.
- **Defaults section: always collapsed**. Show `{N} defaults set` ICU-plural badge in header when any are set.
- **Slug = plain text** in dialog (no link affordance) until public stall detail page lands.
- **Accent color + image management out of dialog** → consolidated "Appearance" panel on detail page.
- **List-card thumbnail upload stays as-is** — don't touch.
- **a11y baked**: form errors `aria-live="polite"`, field errors `aria-describedby`, collapsible `aria-expanded`+`aria-controls`, radio cards `role="radiogroup"`+`aria-checked`.
- **Defaults grouped into Content** (category, location, tags) **+ Commerce** (condition, ships, accept-offers) with subtle gap.
- **Validate on blur**, not keystroke.
- **Stall-name-taken** → inline error on Name field, NOT form-level banner.

## Backend contract (already shipped — just consume)

- `Stall` has new fields: `Visibility` (StallVisibility enum 0=Public, 1=RegisteredOnly, 2=LinkOnly, 3=Private), `DefaultCategoryId` (int?), `DefaultCategoryName` (string? joined server-side), `DefaultLocation` (string?), `DefaultCanShip` (bool), `DefaultTags` (string[]), `DefaultCondition` (int?), `DefaultAcceptOffers` (bool).
- `CreateStallRequest`/`UpdateStallRequest` accept all the above.
- Server validates: `IsDefault → Public` (rejects with `IS_DEFAULT_REQUIRES_PUBLIC`), tags ≤ 10 × 30 chars, category exists. Surface these in the dialog with i18n.
- Public endpoints already cascade visibility — frontend doesn't need to filter manually.

## Branch & commits

- Working branch: `ralph/stall-redesign-frontend` (do not push to or merge into master)
- Commit style: conventional, lowercase verb (`feat:`, `fix:`, `refactor:`)
- One commit per task

## Out of scope for this cycle

- **Backend changes** (`backend/**`) — completely off-limits, Cycle A is merged
- Public stall detail page — separate cycle
- **List-card thumbnail upload UI** — preserved as-is
- New tests
- Doc updates
