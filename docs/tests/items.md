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
