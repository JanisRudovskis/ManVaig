# Profile pages — design audit findings (2026-05-08)

Systematic critique of all profile-feature surfaces using the `/design-critique` framework. Surfaces audited: `/profile` (own, view + edit modes), `/user/[displayName]` (public), ChangeEmailDialog, ChangePhoneDialog, ProfilePopup. Audited at 375px (mobile) and 1280px (desktop).

This file contains the **unfixed** findings — issues that need design discussion, are out of scope, or require bigger changes than I'd land without sign-off. The fixes I already applied inline are listed at the bottom for reference.

Severity legend: 🔴 critical · 🟡 moderate · 🟢 minor

---

## Layout & Hierarchy

### 🟡 Edit/View buttons disconnected from name on desktop
On desktop (`sm:flex-row`), Edit/View buttons sit far-right of the avatar/info row, separated by a wide gap of empty space when the info column doesn't fill the width. They feel "detached" from the name they relate to.
- **Where**: [profile-card.tsx:266-296](frontend/src/components/profile-card.tsx:266) — `flex flex-col sm:flex-row gap-6` with buttons as third item using `self-start`.
- **Options**: (a) cap info column max-width so buttons stay close, (b) move buttons inside the info column at top-right, (c) accept current layout and constrain card max-width tighter.
- **Recommendation**: option (b) — keeps actions adjacent to identity.

### 🟢 Two separators with little content between them when stats are absent
When user has 0 stalls, 0 items, 0 deals AND empty bio AND no channels enabled, the card body shrinks to: avatar/info → separator → "No bio set" → (no second separator anymore — fixed). Card looks vertically thin and underpopulated.
- **Where**: profile-card.tsx full file
- **Options**: (a) hide the bio separator too when stats and channels are both absent, (b) add an "empty state nudge" for new users ("Add a bio so visitors can learn about you"), (c) accept the sparse look for new accounts.
- **Recommendation**: option (b) — turn the empty state into onboarding.

### 🟢 Two strong separators in edit mode create visual fragmentation
Edit mode has 4 visible chunks (avatar/info/visibility, bio, contact info, sticky save) all divided by full-width separators of equal weight. Hard to scan; no clear primary section.
- **Where**: profile-card.tsx — three `<Separator className="my-4" />` calls
- **Options**: lighter borders (`border-t border-border/50`), or wrap each section in a faint `bg-muted/30` rounded card, or use uppercase tracking section labels with no separator.
- **Recommendation**: section labels (e.g. small uppercase muted text "Profile", "Bio", "Contact") — better hierarchy without adding visual noise.

---

## Empty states

### 🟢 "No bio set" placeholder lacks call-to-action
Owner viewing their own profile with empty bio sees a tiny italic line. There's no nudge to add one.
- **Options**: (a) make the italic placeholder a button that opens edit mode focused on bio, (b) add a subtle "+ Add bio" link below, (c) leave it.
- **Recommendation**: option (a) — minimal UI change, big UX improvement.

### 🟢 "No location set" likewise has no CTA
Same pattern. If location is empty, "No location set" shows in muted text. Owner has to enter edit mode and find the location field.
- **Options**: same as bio — clickable placeholder that opens edit + focuses the location.

### 🟡 Empty new-user profile is dead space
A brand-new account with no bio, no location, no listings has a card that's very short and the rest of the viewport is empty.
- **Options**: add an onboarding checklist below the card ("Set up your profile: ✓ Avatar, ☐ Bio, ☐ Location, ☐ List your first item"). Out of scope for design polish — would need product spec.
- **Recommendation**: log for product roadmap.

---

## ProfilePopup (View)

### 🟡 Popup duplicates `/user/[displayName]`
The "View" button on own profile opens a popup that shows the same content as `/user/Čaks`, with a "View full profile" link at the bottom that navigates there. Two paths, same data. Users may be confused about why both exist.
- **Where**: [profile-popup.tsx](frontend/src/components/profile-popup.tsx) + [profile-card.tsx](frontend/src/components/profile-card.tsx) "View" button
- **Options**: (a) remove the popup entirely, "View" navigates directly to `/user/Čaks`, (b) keep popup, drop "View full profile" link (popup IS the preview), (c) keep both with clearer copy distinguishing them.
- **Recommendation**: option (a) — cleanest. The preview value is low when the public route is one click away.

### 🟡 Drag handle on mobile suggests swipe-to-dismiss but doesn't implement it
The horizontal drag-handle bar on the mobile bottom-sheet popup is an iOS convention that means "swipe down to dismiss". The popup has no swipe handler, so the visual lies.
- **Where**: [profile-popup.tsx:79-82](frontend/src/components/profile-popup.tsx:79)
- **Options**: (a) implement swipe-to-dismiss (non-trivial — needs touch event handlers + spring animation), (b) remove the drag handle visual, (c) keep as decorative-only.
- **Recommendation**: option (b) for now. Swipe-to-dismiss can be a future polish task.

### 🟢 Popup desktop appearance is a bit small
On desktop (`sm:max-w-md` = 448px), the centered modal is narrow. Stats chips and contact chips can wrap awkwardly when there are many.
- **Options**: bump to `sm:max-w-lg` (512px) on desktop.
- **Recommendation**: try larger size; cheap to revert.

---

## Visibility quick-toggle

### 🟢 Visibility master switch is hidden inside edit mode
The single highest-signal setting (public/private) is buried — owner must click Edit, find the switch, change it, save. No quick-toggle from view mode.
- **Options**: show a small Globe/Lock chip below the avatar even in view mode that opens a confirmation dialog when clicked ("Make profile private?").
- **Recommendation**: log — adds complexity, not strictly needed for v1.

---

## ChangeEmailDialog / ChangePhoneDialog

### 🟢 Verbose description copy
"We'll send a verification link to the new address. Your current email stays active until you confirm." — could be terser: "We'll email a verification link. Your old email stays until confirmed."
- **Options**: copy edit (simple but subjective).
- **Recommendation**: log — not blocking, copy is reasonable.

### 🟢 No hint explaining why current password is required
User might think the password field is asking for their NEW password. A small helper text would clarify the security check.
- **Options**: tooltip on the label, or small italic line "Required for security".
- **Recommendation**: add italic helper text under the password label.

### 🟢 Cooldown UI uses one button to do two things
"Send verification" / "Resend in m:ss" share the same button. When cooldown is active, button is disabled and shows the timer. Functional but could be cleaner with the timer in helper text and the button just disabled.
- **Recommendation**: log — works as-is.

### 🟡 No focus indicator visible on Cancel button (visual verification needed)
shadcn `variant="outline"` should give a focus ring but the dark theme might mask it. Verify in browser with keyboard-only navigation.
- **Recommendation**: visual verify; add `focus-visible:ring-2 focus-visible:ring-primary` if missing.

---

## Public profile (`/user/[displayName]`)

### 🟢 No back-button affordance
Users land on a public profile from a listing card. Mobile back gesture works, but desktop has no visible "Back to listings" button. Browser back works but isn't an in-app affordance.
- **Options**: small "← Back" link in top-left when document.referrer is internal.
- **Recommendation**: log — browser back is fine for v1.

### 🟢 "Showing X of Y" is muted, easy to miss
The count text below the active-listings header is `text-xs text-muted-foreground`. The "View all listings" button I added is the actual affordance — the count text is now redundant.
- **Options**: remove "Showing X of Y" since the button now shows the total.
- **Recommendation**: remove.

### 🟡 `/user/[displayName]/items` route doesn't exist yet
The "View all N listings" button I added links to a route that 404s. Acknowledged stub per your instruction.
- **Recommendation**: build the dedicated page when ready. Until then, the button is a known broken link.

---

## Touch targets / mobile fidelity

### 🟢 Edit / View buttons in card header use shadcn `size="sm"` = 32px height
Apple HIG min is 44px, WCAG 2.5.5 AAA is 44x44. Buttons are still tappable but on the small side.
- **Recommendation**: log — `size="sm"` is the project's chosen density. Bumping to default `size` would change the entire card's button rhythm.

### 🟢 Close button on dialogs is 32px (size-icon-sm in shadcn dialog.tsx default)
Same comment. Functional but below 44px.

---

## Consistency

### 🟢 Stat pill density differs between card and popup
Card uses `px-3 py-1.5 text-sm`, popup uses `px-2.5 py-1 text-xs`. Intentional (popup is more compact) but slightly jarring when comparing the two.
- **Recommendation**: log — defensible.

### 🟢 Phone shown as `Phone` icon on card row but with `Smartphone` icon when channel chip in older view
After my fixes I unified to `Phone`. Verify no `Smartphone` references remain in new code paths.
- **Status**: already swapped in profile-card. Verify after future changes.

---

## Accessibility (already addressed but worth tracking)

- ✅ Focus trap on dialogs — handled by base-ui Dialog primitive (no fix needed)
- ✅ aria-modal, role=dialog — handled by base-ui
- ✅ Escape closes dialog — base-ui
- ✅ Body scroll lock — base-ui
- ✅ aria-disabled on locked channels block — applied in Phase 3
- ✅ Color contrast bumped to -700/-300 shades — applied in Phase 3
- 🟡 **Verify focus rings are visible in dark mode** — visual check only

---

## Already-fixed in this session

For reference, the inline fixes I shipped:

| # | Fix | Files |
|---|---|---|
| F1 | Drop empty separators when bio AND/OR channels block has nothing to show in view mode (was rendering 2 consecutive separators with no content between) | profile-card.tsx |
| F2 | Email/phone rows wrap on narrow widths so email isn't truncated; verified badge breaks to its own row when needed; "Change email/phone" buttons aligned right with `ml-auto` | email-management.tsx, phone-management.tsx |
| F3 | Wrapped change-email/phone forms in `<form onSubmit>` so Enter key submits from any field, not just password | change-email-dialog.tsx, change-phone-dialog.tsx |
| F4 | Touch target on "Change email" / "Change phone" trigger buttons bumped from h-6 (24px) to h-8 (32px) — closer to mobile minimum | email-management.tsx, phone-management.tsx |

---

## Recommended next steps (in rough priority order)

1. **Decide on the popup** (remove vs keep without "View full profile" link) — biggest UX win, simplest change.
2. **Section labels instead of separators in edit mode** — improves scannability.
3. **Click-to-edit empty-state placeholders** for bio and location — onboarding nudge.
4. **Move Edit/View buttons inside the info column** on desktop so they sit near the name.
5. **Build `/user/[displayName]/items`** to unblock the View all listings stub.
6. **Remove "Showing X of Y" text** now that the button exposes the count.
7. **Drop drag handle on popup** OR commit to building swipe-to-dismiss.
8. **Verify focus rings in dark mode** with keyboard navigation.
