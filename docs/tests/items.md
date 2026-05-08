# Items Test Cases

> Run these when: item-related code changes, pricing/condition changes, or on command "test items"

## Add Item — 2-Step Wizard

- [ ] Navigate to stall → "Add Item" button → wizard opens at step 1
- [ ] Step 1: Category dropdown (required), ImageManager, Title, Description, Condition, Location
- [ ] Step 2: Pricing + Terms (uses unified item form tabs)
- [ ] Cannot proceed without category + title + at least 1 image
- [ ] Submit creates item in correct stall
- [ ] New item appears in stall items grid

## Edit Item — Unified Form (3 Tabs)

- [ ] Click item card → edit modal opens with 3 tabs (Details, Pricing, Terms)
- [ ] Tab switching preserves unsaved data
- [ ] Modal does not change size when switching tabs
- [ ] Save updates item correctly
- [ ] Cancel discards changes

## Composable Pricing

- [ ] Price-only item: set price, leave "Accept offers" OFF → creates fixed-price item
- [ ] Price + offers: set price, turn ON "Accept offers" → shows MinOfferPrice, OfferStep fields
- [ ] Offers only: leave price empty, turn ON "Accept offers" → valid (no price required)
- [ ] Timed offers: turn ON "Accept offers" → "Set end date" toggle appears → turn ON → DateTimePicker shows
- [ ] End date must be >= 1 hour from now (validation error otherwise)
- [ ] Cannot save with no price AND "Accept offers" OFF (validation error: must have price or offers)
- [ ] End date toggle only visible when "Accept offers" is ON
- [ ] Turning OFF "Accept offers" clears MinOfferPrice, OfferStep, EndDate silently
- [ ] MinOfferPrice must be <= Price when both set

## 5-Condition Enum

- [ ] Condition selector shows 5 options: New, Like New, Good, Fair, Poor
- [ ] Default condition is "Good" for new items
- [ ] All 5 conditions display correctly in EN and LV
- [ ] Existing items migrated correctly (Used→Good, Worn→Poor)

## Delete Confirmation Dialog

- [ ] Delete button in edit form → countdown dialog appears
- [ ] Dialog shows item thumbnail + title
- [ ] Dialog shows warning: "This action cannot be undone" + consequences
- [ ] Delete button disabled for 3 seconds (shows "Delete (3...)" countdown)
- [ ] Items with active offers: 5-second countdown + extra warning about cancelled offers
- [ ] Can cancel dialog (click backdrop or Cancel button)
- [ ] After countdown, Delete button becomes active
- [ ] Confirming delete removes item and closes modal
- [ ] Countdown resets if dialog is closed and reopened

## Item Card Indicators

- [ ] Fixed-price item: shows price, no offer icon
- [ ] Price + offers: shows price with chat icon next to it
- [ ] Offers only (no price): shows "Offer" / "Piedavajums" text
- [ ] Timed item: countdown pill on image (top-right)
- [ ] Countdown colors: normal (muted), < 24h (orange), < 1h (red)
- [ ] Ended timed item: shows "Ended" badge
- [ ] Highest bid + offer count displayed when offers exist

## Item Detail Page

- [ ] Price displayed large (emerald) when set
- [ ] AcceptOffers: shows "Open to offers" label
- [ ] EndDate: shows countdown
- [ ] Action button logic:
  - Price only → "Contact Seller"
  - AcceptOffers → "Make Offer"
  - AcceptOffers + EndDate (not ended) → "Place Bid"
  - Ended → disabled / no button

## Stall Items Page

- [ ] Items display with correct field-based indicators
- [ ] "Needs attention" filter works (ended items, items with offers)
- [ ] Activity badges show correctly (offer count, highest offer, ended/ending soon)
- [ ] Item reordering still works

## My Items Page

- [ ] All items listed with correct pricing indicators
- [ ] Field renames work (no references to old PricingType/MinBidPrice/BidStep/AuctionEnd)

## i18n

- [ ] Switch to Latvian → all pricing labels, condition names, dialog text translate correctly
- [ ] Switch back to English → all text back to English
- [ ] Condition names: EN (New/Like New/Good/Fair/Poor) vs LV (Jauns/Gandrīz jauns/Labs/Vidējs/Slikts)
- [ ] Pricing labels: "Accept offers" / "Pieņemt piedāvājumus", "Set end date" / "Iestatīt beigu datumu"

## Backend Validation

- [ ] POST /api/v1/items — no price AND acceptOffers=false → 400 error
- [ ] POST /api/v1/items — price <= 0 → 400 error
- [ ] POST /api/v1/items — endDate without acceptOffers → 400 error
- [ ] POST /api/v1/items — endDate < now+1h → 400 error
- [ ] POST /api/v1/items — minOfferPrice > price → 400 error
- [ ] PUT /api/v1/items/:id — locked timed item with offers → 403
- [ ] Offer placement works on any offer-enabled item (not just old Auction type)
- [ ] Anti-snipe extension only triggers on timed items

## Help System — Inline Hints (Layer 1)

- [ ] Title field: hint text visible below input ("Be specific...")
- [ ] Description field: hint text visible below textarea
- [ ] Images section: hint text visible below ImageManager
- [ ] Price field: hint text visible below input (or error if invalid)
- [ ] All hints display in LV when language switched

## Help System — HelpPopover (Layer 2)

- [ ] (?) icon visible next to: Condition, Tags, Accept Offers, End Date, Visibility, Min Offer Price
- [ ] Clicking (?) opens popover with title + description
- [ ] Tags popover shows good/bad examples (green/red labels)
- [ ] Condition popover shows all 5 condition level descriptions
- [ ] Popovers work on mobile (tap to open, tap outside to close)
- [ ] Popovers render above edit modal (not hidden behind z-index)
- [ ] All popover text translates correctly in LV

## Help System — Tips Banner (Layer 3)

- [ ] Tips banner appears at top of each tab (Details, Pricing, Terms) on first visit
- [ ] Each banner shows 4 tips as bullet list with amber styling
- [ ] Clicking X dismisses banner permanently (survives page refresh)
- [ ] Cookie `manvaig_tips_dismissed` updates correctly (check DevTools → Cookies)
- [ ] Dismissing one tab's tips does not affect other tabs
- [ ] Sidebar More menu shows "Show listing tips" toggle with Lightbulb icon
- [ ] When all tips visible: toggle shows checkmark, is disabled
- [ ] When some tips dismissed: clicking toggle restores all tips
- [ ] No console errors for missing i18n keys
- [ ] All tip text translates correctly in LV

## Bidding / Offers Popup

### Place Bid
- [ ] Open offers popup from item card → bottom sheet (mobile) / centered modal (desktop)
- [ ] Background page scroll is locked while popup is open
- [ ] Bid amount input pre-filled with minimum next bid
- [ ] +/- buttons increment/decrement by offer step
- [ ] − button disabled when at minimum bid
- [ ] Cannot type amount below minimum
- [ ] First tap on "Piedāvāt" → button turns amber "Apstiprināt €X.XX?"
- [ ] Second tap → bid submitted
- [ ] Confirm resets after 3 seconds if no second tap
- [ ] Changing amount (type or +/−) resets confirm state
- [ ] Anonymous toggle persists to localStorage (survives popup reopen)
- [ ] Update-in-place: placing bid with same anonymity mode updates existing bid (not new row)
- [ ] Max 1 anonymous + 1 non-anonymous active bid per user per item
- [ ] Cannot bid on own item (message shown)
- [ ] Cannot bid when bidding paused/closed/ended (message shown)
- [ ] Error messages display clearly above input (red text)
- [ ] Success message shows after bid placed (green text, fades after 3s)

### Bid List
- [ ] Bids sorted highest first with reverse numbering (#17 = newest)
- [ ] Top bid highlighted with green left border
- [ ] Own bids show "You" pill
- [ ] Anonymous bids show EyeOff icon + "Anonīms" label
- [ ] Denied bids: struck-through amount, muted opacity
- [ ] New bids slide in with animation
- [ ] "Show all" button loads full bid list
- [ ] Bidder count shown in header subtitle

### Seller Actions
- [ ] Accept button on Active bids → confirmation dialog → bid becomes Accepted, bidding pauses
- [ ] Deny button on Active bids → bid becomes Denied (struck-through)
- [ ] Complete Deal button on Accepted bid → bid becomes Completed, item shown as "Sold"
- [ ] Deal Failed button on Accepted bid → bid becomes Failed, bidding reopens
- [ ] Contact info (emails) revealed to both parties after acceptance

### Real-time Features
- [ ] Bid list auto-refreshes every 10 seconds
- [ ] After poll failure, retries every 3 seconds
- [ ] Stale data warning appears after 20+ seconds without update
- [ ] Tab focus triggers immediate refresh
- [ ] Manual refresh button spins during refresh
- [ ] Sound notification (coin drop) plays on new external bid
- [ ] Sound toggle (speaker icon) saves to localStorage in popup mode
- [ ] Sound toggle does NOT save to localStorage in tab page mode (session only)
- [ ] Tab page always starts with sound OFF

### Full Offers Page (/items/[id]/offers)
- [ ] Opens in new tab from popup external link button
- [ ] Tab title blinks when new bid arrives while tab is in background
- [ ] Tab title stops blinking when tab becomes visible
- [ ] All shared components work same as popup (bid list, form, actions)

### Image Gallery
- [ ] Click item thumbnail → fullscreen gallery opens
- [ ] Arrow buttons navigate between images
- [ ] Keyboard arrows + Escape work
- [ ] Image counter "1 / 3" shown
- [ ] Click backdrop or X closes gallery

### Anti-snipe
- [ ] Bid placed in last 10 minutes of timed auction extends EndDate by 10 minutes
- [ ] Countdown updates to reflect extended time

### Backend Validation
- [ ] Amount must be > highest active bid (BID_TOO_LOW)
- [ ] Amount must be >= minOfferPrice (BID_BELOW_STARTING)
- [ ] Amount must respect offerStep above highest (BID_STEP_TOO_SMALL) — skip when raising own highest
- [ ] Cannot bid when Accepted bid exists (BIDDING_PAUSED)
- [ ] Cannot bid when Completed bid exists (BIDDING_CLOSED)
- [ ] Cannot bid on own item (CANNOT_BID_OWN_ITEM)
- [ ] Accept: only Active bids, only one at a time
- [ ] Complete/Fail: only from Accepted status
- [ ] Deny: only Active bids
