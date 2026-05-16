# Bidding / Offers System — Test Cases

> Last updated: 2026-05-16

## Bid Placement

### Basic Bidding
- [ ] Logged-in user can place a bid on an item with AcceptOffers=true
- [ ] Bid amount must exceed current highest bid
- [ ] Bid amount must respect MinOfferPrice (floor)
- [ ] Bid amount must respect OfferStep (minimum increment)
- [ ] Update-in-place: new bid from same user replaces their existing active bid
- [ ] Only 1 active bid per user per item at any time
- [ ] Owner cannot bid on their own item (rejected by backend)
- [ ] Unauthenticated users see "Log in to place offer" prompt
- [ ] Bid rejected if item IsSold=true
- [ ] Bid rejected if timed item's EndDate has passed

### Two-Tap Confirm
- [ ] First tap on "Place offer" hides stepper+input, shows Cancel + Confirm pair
- [ ] Cancel and Confirm buttons are equal-width, filling the row
- [ ] Second tap (Confirm) submits the bid
- [ ] Cancel returns to stepper+input state
- [ ] Confirm auto-resets to stepper+input after 3 seconds if not clicked
- [ ] Amount shown in confirmation matches the input value

### Stepper Controls (+/- Buttons)
- [ ] Plus button increments amount by OfferStep
- [ ] Minus button decrements amount by OfferStep
- [ ] Minus disabled when amount is at minimum allowed bid
- [ ] Manual typing in input field overrides stepper value
- [ ] Input shows no native number spinners (no-spinner class)

### Anti-Snipe
- [ ] Bid placed within last 10 minutes of timed auction extends EndDate by 10 minutes
- [ ] Extension visible to all viewers (countdown updates)
- [ ] Non-timed items: no anti-snipe behavior

## Offers Popup (Modal)

### Layout (Ticker v2)
- [ ] Mobile: bottom sheet with rounded top corners, h-[85vh]
- [ ] Desktop: centered modal, max-width 480px, max-height 85vh
- [ ] Dark theme locked (class="dark" on popup root)
- [ ] Backdrop overlay with blur visible behind popup
- [ ] base-ui Dialog: focus trap, ESC → close, focus return on unmount
- [ ] z-[51] above backdrop z-50
- [ ] Body scrolls when expanded bid list exceeds viewport

### Header
- [ ] Live dot (8px green circle with halo) when auction is live
- [ ] Item title (text-sm, truncated, text-ticker-mid)
- [ ] Sound toggle: Volume2 (green) / VolumeX
- [ ] Refresh button with 720° spin animation while refreshing
- [ ] External link opens /items/{id}/offers in new tab
- [ ] Close button (X) — slightly larger on mobile (22px vs 20px)
- [ ] Bell icon hidden unless NEXT_PUBLIC_BID_NOTIFICATIONS=on
- [ ] Refresh + external survive auction-end state
- [ ] Connection lost: red dot + error message + close button only

### Hero
- [ ] "TOP OFFER" label (mono, 11px, tracking-wide, dimmed)
- [ ] Price: 76px desktop / 68px mobile, rolling digits (RollingDigit component)
- [ ] Currency (€) and decimals (.XX) dimmed (text-ticker-mid)
- [ ] From-line: "from {bidder} · {timeAgo}" with fade-in animation on bidder change
- [ ] Empty state: "—.—" with "No offers yet" message
- [ ] Emerald flash (radial gradient) on new external bid arrival
- [ ] Delta badge ("+€{delta}") drifts up and fades over 1.8s on new bid

### Your Bid Card
- [ ] Shown only when user has an active bid
- [ ] "YOUR OFFER" label (emerald) + rank "#X of Y" (dimmed)
- [ ] Amount (mono, 22px, bold) + "€{delta} below top" when not #1
- [ ] Green border, bg-ticker-bg-2

### Time Strip
- [ ] No end date: "Open for offers" between hairlines
- [ ] Normal (>10min left): "ends in Xh Ym" between hairlines
- [ ] Final 10 minutes: amber promoted countdown box with MM:SS ticking each second
- [ ] Final minute: red countdown box, label changes to "FINAL MINUTE"
- [ ] Heartbeat pulse aura behind hero price (amber, 2.6s loop)
- [ ] Final minute pulse: red, faster (1.4s loop)
- [ ] Sold/ended: status banner with label + time

### Bid Form
- [ ] Label above: "Place an offer" (no bid) / "Raise your offer" (has bid)
- [ ] Stepper: - / input / + row, h-13 (52px), rounded-xl
- [ ] Input: mono 22px bold, € prefix, no native spinners
- [ ] Submit: green button "Place offer"
- [ ] Hint below: "Minimum €{amount}"
- [ ] Owner sees "This is your item" instead of form
- [ ] Not logged in sees "Log in to place offer" button

### Expanded Bid List
- [ ] Collapsed: "Show all offers ▾" link (when totalBids > 1)
- [ ] First click loads next 5 bids (paginated, not all at once)
- [ ] Each row: #rank + avatar + name + "you" badge + amount
- [ ] "Load N more offers ▾" link when more bids remain on server
- [ ] "Show less" collapses back to initial state (5 bids, list hidden)

### Opening Popup
- [ ] "View offers" / offer button on item detail page opens popup
- [ ] "View offers" on My Items page opens popup
- [ ] "View offers" on stall items page opens popup
- [ ] "View offers" on homepage item cards opens popup
- [ ] "View offers" on search results opens popup
- [ ] "View offers" on item detail modal opens popup

## Offers Page (/items/[id]/offers)

### Full-Page View
- [ ] Navigable directly via URL
- [ ] Header with back link to item detail page
- [ ] Item thumbnail clickable (opens image gallery)
- [ ] Page title set to "Offers - {item title}"
- [ ] Sound toggle button in header
- [ ] Refresh button in header

### Tab Title Blink
- [ ] When tab is in background and new bid arrives, tab title blinks
- [ ] Blink alternates between original title and new bid notification
- [ ] Blink stops when tab regains focus
- [ ] Blink interval is ~1 second

### Message Button (Seller)
- [ ] Seller sees "Message" button on each bid row
- [ ] Timed items: message button only visible after auction ends
- [ ] Non-timed items: message button always visible
- [ ] Clicking "Message" creates conversation and navigates to /messages/{id}
- [ ] Error shown if conversation creation fails
- [ ] Non-sellers never see message buttons

## Bid List

### Display
- [ ] Bids ordered by amount descending (highest first)
- [ ] Each bid row shows: bidder name, avatar, amount, time ago
- [ ] Top bid visually highlighted (flash animation on new top bid)
- [ ] Own bids marked distinctly
- [ ] New bids slide in with animation (bid-slide-in class)
- [ ] Skeleton loading state while fetching

### Expand/Collapse
- [ ] Initial load shows limited bids (INITIAL_LIMIT)
- [ ] "Show all" button expands to full list when more bids exist
- [ ] "Show less" collapses back to initial limit
- [ ] Bid count indicator shows total vs displayed

### Status Banner
- [ ] Active: shows highest bid amount + bid count
- [ ] Ended (timed): shows "Auction ended" with winner info
- [ ] Sold: shows "Sold" status
- [ ] No bids: shows "No offers yet" state

## Real-Time Updates

### Polling
- [ ] Normal polling interval: 10 seconds
- [ ] Error/retry polling: 3 seconds
- [ ] Polling pauses when bid input is focused (avoids disrupting typing)
- [ ] Tab focus triggers immediate refresh
- [ ] Manual refresh button works and shows spinner

### Sound Notifications
- [ ] Web Audio API "warm" chime (bid-ding.wav) on new external bid
- [ ] No sound for own bids
- [ ] Sound toggle persists to localStorage (popup mode)
- [ ] Sound toggle session-only (tab/page mode)
- [ ] Sound icon reflects current state (Volume2 green vs VolumeX dimmed)

### Refresh Animation
- [ ] Refresh icon spins 720° over 650ms (is-spinning class)
- [ ] Hero emerald flash (radial gradient) on new bid arrival
- [ ] Rolling digits animate over 700ms (CSS transition on translateY)
- [ ] Delta badge "+€{delta}" drops in and drifts up over 1.8s
- [ ] Bidder name fades in on change (tx-from-anim, 420ms)
- [ ] No flash/badge/sound for own bids

### Reliability Indicators
- [ ] Stale data warning after extended time without successful poll
- [ ] Connection lost detection after multiple consecutive failures
- [ ] Connection-lost banner with retry/refresh prompt
- [ ] Freshness indicator shows time since last successful update
- [ ] Manual refresh clears stale/error state on success

## API Endpoints

### GET /api/v1/items/{itemId}/bids
- [ ] Public endpoint (no auth required)
- [ ] Returns active bids ordered by amount descending, denied bids appended at end
- [ ] Response includes: bids[], totalBids (active only), highestBid (active only), minNextBid, acceptOffers, price, minOfferPrice, offerStep, endDate, isOwner, isSold, uniqueBidders (when isOwner)
- [ ] Each bid includes: id, bidderName, bidderAvatarUrl, bidderId, amount, isOwnBid, status ("Active"/"Denied"), denyReason, createdAt
- [ ] uniqueBidders: grouped by user, active bidders first then denied, each with bestAmount, bidCount, lastBidAt, isTop, isDenied, denyReason, denyDetail
- [ ] Supports ?limit= parameter for pagination (applies to active bids only)
- [ ] isOwnBid correctly set when authenticated user's bid is in list

### POST /api/v1/items/{itemId}/bids
- [ ] Requires Bearer auth
- [ ] Body: { amount: decimal }
- [ ] Returns 200 with updated bid on success
- [ ] Returns 400 if amount <= current highest
- [ ] Returns 400 if amount < minOfferPrice
- [ ] Returns 400 if amount doesn't respect offerStep
- [ ] Returns 400 if item IsSold
- [ ] Returns 400 if timed item has ended
- [ ] Returns 403 if bidding on own item
- [ ] Returns 401 if not authenticated
- [ ] Anti-snipe: extends EndDate by 10 min if bid within last 10 min

## Timed Auction Lifecycle

### Active Auction
- [ ] Countdown visible showing time until EndDate
- [ ] Bids accepted normally
- [ ] Anti-snipe extends deadline

### Auction Ended
- [ ] AuctionEndedService detects EndDate passed (within 60s)
- [ ] Sets IsSold=true on item (if has bids)
- [ ] Notifies seller (AuctionEnded notification)
- [ ] Notifies winner (BidAccepted notification — highest bidder)
- [ ] No more bids accepted after end
- [ ] Ended items show final result

### Sold Item
- [ ] Sold items filtered from: homepage feed, search results, browse pages, profile listings
- [ ] SOLD badge shown on seller's item cards (My Items, stall pages)
- [ ] Sold items are readonly (cannot edit)
- [ ] Offer lock: timed items with active bids locked during auction + 48h grace

### No Bids at End
- [ ] If timed item ends with 0 bids, IsSold NOT set
- [ ] No grace period — seller can edit/delete immediately

## Seller View (seller-offers-popup.tsx)

### Summary Line
- [ ] Shows top bid amount + "top of N bidders" when active bids exist
- [ ] Shows time clause (ends in / ended / sold) when item has endDate
- [ ] Shows "No active offers" when all bids denied or no bids
- [ ] Does NOT show "Open for offers" text (that's buyer language)
- [ ] Price hidden when no active bids

### Bidder Cards
- [ ] One card per unique bidder, sorted by best amount descending
- [ ] Top bidder: emerald border + crown icon chip (22px, filled SVG)
- [ ] Multi-bid bidder: "+N bids" amber pill (when bidCount >= 2)
- [ ] Each card shows: avatar, name, offer count + "last X ago", amount, deny button
- [ ] Denied bidders: faded (opacity 50%), DENIED pill, reason text, strikethrough amount, no deny button
- [ ] Denied bidder with "Other" reason: "see more" link expands full detail text (break-all for long strings)
- [ ] Same user can appear twice: once active (re-bid), once denied (old bid)
- [ ] Paginated: initial 5, "Show N more bidders" loads rest

### Deny Flow
- [ ] Tapping ⊘ icon opens DenyReasonModal as nested Dialog over bidder list
- [ ] Modal shows: "DENY OFFER" kicker (red), "Why are you denying?" title, close X
- [ ] Target row: avatar + name + offer count + amount
- [ ] Three radio reasons: Fake or accidental (default), Don't trust buyer, Other
- [ ] "Other" shows required textarea (500 char max, placeholder "Explain why...")
- [ ] Cancel closes modal, no changes
- [ ] "Deny offer" button fires POST, refreshes data, closes modal
- [ ] "Deny offer" disabled when "Other" selected but textarea empty
- [ ] Focus trapped inside deny modal, ESC closes it
- [ ] Denied bidder card appears in list after refresh (faded, with reason)

### POST /api/v1/items/{itemId}/bidders/{bidderId}/deny
- [ ] Requires Bearer auth + seller must own the item
- [ ] Body: { reason: "fake_or_accidental" | "dont_trust" | "other", detail?: string }
- [ ] Marks all active bids from that bidder as Denied
- [ ] Stores DenyReason, DenyDetail (only for "other"), DeniedAt on each bid
- [ ] Returns 200 with { denied: count }
- [ ] Returns 403 if not item owner
- [ ] Returns 404 if no active bids from that bidder
- [ ] Triggers BidDenied notification to the bidder

## Denied Bid Visibility

### Buyer View
- [ ] Denied bids shown at bottom of expanded list (faded, "—" instead of rank, DENIED pill, strikethrough)
- [ ] YourBid card: if own bid denied → red border, DENIED pill, strikethrough amount, reason text
- [ ] Denied bids NOT counted in totalBids, highestBid, minNextBid
- [ ] Denied user can place new bid (creates fresh Active bid, not update-in-place)

### Seller View
- [ ] Denied bidders shown at bottom of bidder cards list (faded, no deny button)
- [ ] Denied bidder who re-bids: two cards — active (new bid) + denied (old bid)
- [ ] Summary line counts only active bidders

## BidDenied Notification

### Backend
- [ ] BidDenied notification created on deny (type=4)
- [ ] Notification includes: itemId, bidId, denyReason
- [ ] DenyDetail pulled from Bid via BidId relationship
- [ ] SignalR count update sent to denied bidder

### Frontend
- [ ] Notification dropdown: "Your €X offer on {item} was declined"
- [ ] Reason chip visible inline: "Reason · {reason label}" (muted red, 11px)
- [ ] "Other" reason with detail: shows seller's custom text instead of label
- [ ] Click navigates to /items/{itemId}
- [ ] Full notifications page: same rendering
- [ ] Reason labels localized (EN + LV) in notifications namespace

## Edge Cases

- [ ] Very large bid amounts render correctly (tabular-nums formatting)
- [ ] Rapid bid placement by multiple users doesn't cause race conditions (DB-level check)
- [ ] Item deleted while offers popup open — graceful handling
- [ ] Network disconnect during bid placement — error shown, no duplicate bids
- [ ] Browser back button from offers page navigates correctly
- [ ] Multiple browser tabs with same offers page — all receive updates independently
- [ ] Item with AcceptOffers=false — no bid UI shown, "Offers not accepted" message
- [ ] Deny → re-bid → deny again — each denial creates separate denied entry
- [ ] Deny all bidders — summary shows "No active offers", no price
- [ ] Long custom deny reason text wraps correctly (break-all)
- [ ] Notification for deleted item — navigates to item page which shows "not found"
