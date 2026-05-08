# Profile Test Cases

> Run these when: profile pages change, ProfileCard / ProfilePopup / EmailManagement / PhoneManagement modified, or on command "test profile".

## Own Profile — View Mode (`/profile`)

- [ ] Logged in: card renders with avatar, display name, badges, location, member since
- [ ] Edit + View buttons visible top-right of the card
- [ ] If profile is public and channels are enabled: contact channels show as colored chips (email pill, phone pill, optional WhatsApp pill, Telegram pill)
- [ ] Stats bar shows stalls / items / completed deals (deals chip in green only if > 0)
- [ ] Last-seen indicator shows "Online" (green dot) or "Seen N min/h/d ago"
- [ ] Bio renders as plain text; if no bio, shows muted "No bio set" italic placeholder
- [ ] Email and phone rows show with verified/notVerified badge

## Own Profile — Edit Mode

- [ ] Click Edit → card switches to edit mode, Edit/View buttons replaced by sticky Save/Cancel footer at bottom of card
- [ ] **Visibility master switch is the FIRST control** in edit info column (above email/phone)
- [ ] Globe icon (emerald) when public, Lock icon (amber) when private
- [ ] Click anywhere on the visibility switch description text → switch toggles (label association working)
- [ ] Bio textarea has live counter (`N/1000`); turns red if N > 1000; counter does NOT silently truncate input (no browser `maxLength`)
- [ ] Validation error appears above sticky footer when bio > 1000 chars and Save clicked
- [ ] Channels block (email/phone/whatsapp/telegram switches) is always editable, even when profile is private (private profiles are visible to logged-in users)
- [ ] WhatsApp sub-toggle only visible when Phone toggle is on
- [ ] Toggling Phone OFF auto-clears WhatsApp toggle
- [ ] Telegram inline username input appears only when Telegram toggle is on
- [ ] Save → API called, profile updated, returns to view mode
- [ ] Cancel → all fields (bio, location, telegram username, isPublic, channels, avatar) revert to last-saved values
- [ ] Save/Cancel footer **stays visible at viewport bottom** when scrolling a long edit form
- [ ] Save/Cancel disabled while saving; Loader2 spinner appears on Save button

## Own Profile — Email Management

- [ ] In view mode: email row shows email + Verified/Not verified badge (no Change button)
- [ ] In edit mode: "Change email" button appears next to email row
- [ ] Click Change email → modal dialog opens, focused on New email input
- [ ] Tab key cycles through: New email → Password → Cancel → Send verification → close (X) → back to start (focus trap)
- [ ] Escape key closes the dialog
- [ ] Click backdrop closes the dialog (unless saving)
- [ ] Submit with empty email → "Email is required" error
- [ ] Submit with malformed email → "Please enter a valid email address" error (NOT browser native popup — no `type="email"`)
- [ ] Submit without password → "Password is required to change email" error
- [ ] Submit with wrong password → "Incorrect password" error from server
- [ ] Submit with same email → "This is already your current email"
- [ ] Submit with already-taken email → "This email is already in use"
- [ ] Submit valid → email updated locally, dialog closes, 120s cooldown starts
- [ ] During cooldown: "Send verification" button shows clock icon + "Resend in m:ss"
- [ ] Cooldown persists across dialog open/close (state lifted to EmailManagement)
- [ ] Resend button (only when unverified, in edit mode) — sends verification, starts cooldown
- [ ] Server returns 429 → cooldown adjusted to `retryAfter` value, "Please wait before sending another email" error

## Own Profile — Phone Management

- [ ] In view mode: phone row shows phone + Verified/Not verified, OR "No phone set"
- [ ] In edit mode (no phone yet): "Add phone" button appears
- [ ] In edit mode (with phone): "Change phone" button appears
- [ ] Click button → modal opens with title "Add phone" or "Change phone"
- [ ] Phone input pre-filled with current phone (when changing)
- [ ] Same focus-trap, escape, backdrop behavior as email dialog
- [ ] Submit with empty phone → "Phone number is required"
- [ ] Submit without password → "Password is required to change phone"
- [ ] Submit with wrong password → "Incorrect password"
- [ ] Submit with same phone → "This is already your current phone number"
- [ ] Submit when 30-day cooldown not elapsed → "Verified phone numbers can only be changed once per month..."
- [ ] Submit valid → phone updated, dialog closes

## Profile Preview Popup

- [ ] Click View button on own profile → popup opens
- [ ] On mobile (<sm): popup is bottom sheet with rounded top corners + drag handle
- [ ] On desktop (≥sm): popup is centered modal
- [ ] Tab is trapped inside the popup (cannot escape to background)
- [ ] Focus moves into the popup on open
- [ ] Escape key closes the popup (handled by Radix/base-ui Dialog)
- [ ] Click backdrop closes the popup
- [ ] Body scroll is locked while popup is open
- [ ] Close button (top-right X) has `sr-only` "Close" label for screen readers
- [ ] Popup shows: avatar, name, badges, location, member since, last-seen, stats, bio, contact chips (clickable), active listings (up to 4)
- [ ] "View full profile" link at bottom navigates to `/user/[displayName]` and closes popup
- [ ] Item card click closes popup, navigates to `/items/[id]`
- [ ] If user has private profile (logged out) → popup shows avatar + name + lock icon + "private profile" message
- [ ] If user has private profile (logged in) → popup shows full profile
- [ ] If user doesn't exist → popup shows "Profile not found" message

## Public Profile (`/user/[displayName]`)

- [ ] Visit valid public user → ProfileCard renders in read-only mode (no Edit/View buttons)
- [ ] Active listings grid (up to 6 items) appears below the card
- [ ] When `activeListingCount > 6`: "View all N listings" button appears below the grid (currently links to `/user/[displayName]/items` which 404s — stub for future page)
- [ ] When `activeListingCount > listings.length` but ≤ 6: shows "Showing X of Y" text, no button
- [ ] Visit private user (logged out) → limited view: avatar + name + lock icon + "This is a private profile" + "Log in to see the full profile"
- [ ] Visit private user (logged in) → full profile visible (same as public profile)
- [ ] Visit non-existent user → "Profile not found" message
- [ ] Contact chips are clickable: email opens mailto, phone opens tel, WhatsApp/Telegram open in new tab with `rel="noopener noreferrer"`

## Color Contrast (WCAG AA)

- [ ] Verified badge text (`text-emerald-700` light / `text-emerald-300` dark) on `bg-card` — passes AA
- [ ] Not verified badge text (`text-amber-700` light / `text-amber-300` dark) on `bg-card` — passes AA
- [ ] Deals stats chip (`text-emerald-700/300` on `bg-emerald-500/10`) — passes AA
- [ ] Telegram chip (`text-blue-700/300` on `bg-blue-500/10`) — passes AA
- [ ] WhatsApp chip (`text-green-700/300` on `bg-green-500/10`) — passes AA
- [ ] Online indicator (`text-emerald-600/400`) on `bg-card` — passes AA for non-text icon (3:1)

## Cross-locale (LV)

- [ ] Switch to Latvian — all profile labels render in LV
- [ ] Member since shows lowercase month (LV convention) e.g. "maijs 2026"
- [ ] Cooldown timer format `m:ss` works regardless of locale
