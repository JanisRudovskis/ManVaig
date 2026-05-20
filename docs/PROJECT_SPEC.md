# ManVaig — Living Project Spec

> **Working directory:** `C:\GIT\ManVaig`
> **Last updated:** 2026-05-20 (rev 18 — Sell-to-bidder inline expander, sold state BUYER/RUNNERS-UP, close auction footer, notification simplification, dead code cleanup)
> **Status:** 🟢 Phase 5 bidding complete (instant buy + sell-to-bidder + sold state + close auction), Phase 6 notifications simplified

---

## 1. Project Overview

**ManVaig** is a modern pawn-shop / trading marketplace platform where users can open their own shop, list items, and let the community make offers. Price is not fixed — buyers propose what they're willing to pay.

**Core idea:** No price required. Sellers list items, buyers make offers, sellers accept or counter.

**Design philosophy:** Start small, extend later. Every feature is built with future extensibility in mind, but scoped to the simplest working version first.

---

## 2. Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js (React + SSR) | Vercel |
| UI Components | shadcn/ui (Radix UI + Tailwind) | — |
| Responsive | Mobile-first (Tailwind breakpoints) | — |
| Backend API | ASP.NET Core Web API (C#) | Railway |
| Database | PostgreSQL | Railway (or Neon) |
| ORM | EF Core (code-first) | — |
| Auth | ASP.NET Identity + JWT | — |
| Real-time | SignalR | Included in API |
| Images | Cloudinary (free tier) | Cloudinary |
| Email | Resend | Resend |
| Logging | Serilog → Railway logs | — |

---

## 3. Feature List

> Legend: ✅ Done · 🔨 In progress · 🕐 Planned (MVP) · 💡 Future

### Authentication & Accounts
- ✅ User registration (email + password + display name, client-side validation, terms checkbox)
- ✅ User login / logout (dedicated page + modal dialog for contextual login)
- ✅ JWT token auth (7-day expiry, localStorage)
- ✅ Email verification on registration (Resend email, confirm-email page, resend button)
- 🕐 User profile page (avatar, bio, location, communication platforms with predefined toggles)
- 💡 OAuth (Google / Facebook login)
- 💡 Forgot password (reset via email)

### Shop Management
- ✅ Create / edit / delete stalls (multiple per user) — popup `StallFormDialog` with Identity / Visibility / Defaults sections
- ✅ View own stall dashboard (items grid, activity badges, filters, custom reorder)
- ✅ Stall images: thumbnail + header + background, plus accent color — consolidated in "Appearance" panel on detail page; thumbnail also editable inline from `/my-stalls` list card (WYSIWYG shortcut)
- ✅ 4-state stall visibility (Public / RegisteredOnly / LinkOnly / Private) mirroring `ItemVisibility` integers — cascade filtering through `PublicStallsController.Browse`, `PublicItemsController.Browse + Detail`, `ProfileController.GetUserListings`. Default stall locked to Public via `IS_DEFAULT_REQUIRES_PUBLIC`
- ✅ Stall-level defaults for new items: category, location, can-ship, tags, condition, accept-offers — pre-fill ItemForm when adding via wizard with "Defaults applied from this stall" hint banner
- 🕐 Public stall page (`/stalls/[slug]` — visible to all; slug currently rendered as plain text in dialog until this lands)
- 💡 Shop ratings / reviews
- 💡 Featured shops

### Item Listings
- ✅ Add item (2-step wizard: describe → pricing + terms)
- ✅ Edit / delete item (unified 3-tab form: Details, Pricing, Terms)
- ✅ Seller "My Items" management page (card grid, field-based indicators)
- ✅ Composable pricing: Price (optional) + Accept Offers toggle + End Date toggle
- ✅ 5-condition enum: New / LikeNew / Good / Fair / Poor
- ✅ Image upload (max 5 per item, compressed via Cloudinary)
- ✅ Category system (12 flat categories + free-form tags)
- ✅ Item location (Nominatim autocomplete, city+country) + can ship flag
- ✅ Visibility: Public / RegisteredOnly / LinkOnly / Private — UI uses shared `VisibilityRadioCards` component (same control as stall visibility)
- ✅ Allow guest offers toggle per item (default off)
- ✅ Item limit per user (MaxItems, default 10, manually adjustable in DB for v1)
- ✅ Timed items with active offers become readonly (winner visible)
- ✅ Offer/bid history (view who placed offers)
- ✅ Public item detail page
- ✅ Countdown delete confirmation dialog (3s/5s safety timer)
- 💡 Advanced filters (price range, condition, location)

### Bidding / Offer System
- ✅ Public bid list — anyone can see bids (no auth). All bidders identified (registered users only).
- ✅ Place bid (auth required) — amount > highest active, respects minOfferPrice + offerStep. Update-in-place (1 active bid per user). OfferStep enforced for all bidders including top bidder.
- ✅ **Instant Buy** — buyer can purchase at listed price via segmented "Place offer / ⚡ Buy now" switch. 2-tap confirm. Seller accepts/declines. Bidding continues while pending (not locked). Buy Now disabled when any instant buy is pending. Buyer who placed IB can't also bid.
- ✅ **Seller bid management** — deny bidders with reasons (fake/accidental, don't trust, other with detail). Deny button hidden when item is sold.
- ✅ **Sold state** — SoldHero with diagonal SOLD stamp + emerald price + clickable winner name. Action area: Chat with winner + manage options.
- ✅ **Sell to bidder** — inline expandable bidder cards with Sell/Message/Deny, 2-tap sell confirm, reversible (deny winner → unsells)
- ✅ **Close auction** — footer button: amber (with winner) / red (without winner) + confirmation modal. Denies all bids, sets AcceptOffers=false
- ✅ Anti-snipe — bids in last 10 min extend EndDate by 10 min
- ✅ Timed auctions auto-complete — AuctionEndedService sets IsSold + notifies winner
- ✅ Sold items hidden from public feeds
- ✅ Offers popup — bottom sheet mobile / centered modal desktop. Clickable item title in header → item page.
- ✅ Full offers page — /items/{id}/offers, notification links open here
- ✅ Real-time polling (10s, 3s retry) + tab focus refresh + sound notification + tab title blink
- ✅ Reliability indicators — stale data warning, connection lost detection
- ✅ "Message" button on bid rows — seller messages bidders via platform messaging
- 💡 Auto-bidding (proxy bids) — premium users set max limit
- 💡 Auction audit log
- 💡 Buyer bid tracking dashboard ("My Bids" page)

### Discovery
- ✅ Homepage with latest items
- ✅ Unified `/search` page — Items|Stalls segmented tabs, ?q= text search (debounced 300ms, min 2 chars, Enter skips debounce), hint chips, Load more pagination, plural-aware live region. Server: `GET /api/v1/public/items?q=`, `GET /api/v1/public/stalls?q=` — Postgres `unaccent` extension folds Latvian diacritics (`riga` matches `Rīga`)
- ✅ Filter / search by tags (server-side ILIKE on title + description + tag name + stall name + owner)
- 🕐 Browse all items page (no query required, paginated — offset, page + size)
- 🕐 Filter by main category facet on /search
- 💡 Full-text search (`tsvector`/`pg_trgm` indexed) — promote when current `unaccent`-bypasses-index approach hits volume pressure
- 💡 Advanced filters on /search (price range, condition, location)
- 💡 Trending items algorithm

### Notifications
- ✅ In-app real-time notifications (SignalR via AppHub) — minimal model: personal (Outbid, BidDenied, BidWon, InstantBuyAccepted/Declined), seller-only (NewBid, InstantBuyRequested), broadcast only on final close (AuctionEnded, AuctionClosed). Plus: NewItemFromFollowed, ItemDeleted
- ✅ Bell icon + dropdown in TopBar (mark-all-read on open, item thumbnails, relative time)
- ✅ Full notifications page (/notifications) with load-more pagination
- ✅ Follower notification throttling (1hr dedup window — same actor → increment GroupCount)
- ✅ AuctionEndedService (BackgroundService, 60s polling, SemaphoreSlim guard)
- ✅ NotificationCleanupService (90-day retention, 24h cycle, batch delete)
- ✅ Merged use-realtime.ts hook — single SignalR connection for messages + notifications
- 🕐 Email on new offer received (Resend)
- 💡 Email digest
- 💡 Push notifications (browser / mobile)

### UI Foundation
- ✅ Collapsible sidebar (Claude-style, shadcn/ui)
- ✅ Dark / light theme toggle (2-state, respects OS default)
- ✅ Inter font, warm dark theme
- ✅ i18n — English + Latvian (next-intl, cookie-based, no URL prefixes)
- ✅ Language switcher (popover dropdown, scalable)
- ✅ In-form help system — 3 layers: inline hints, (?) help popovers with examples, dismissible tips banners per tab (cookie-persisted, re-enable via sidebar)

### Monetization
- Free tier: 10 items per shop (reduced to 5 when paid plans launch)
- 💡 Paid plans (tiered: Basic / Pro) — details TBD when user base exists
- No payment processing in v1

### Admin / Moderation
- 💡 Admin panel
- 💡 User ban system
- 💡 Report shop / item (scam, misleading, inappropriate) — admin queue
- 💡 Reported listings queue

### Payments — not in scope for v1
- 💡 Stripe integration
- 💡 Escrow / hold system

---

## 4. Category & Tag System

**Concept:**
- Categories — small fixed list, admin-defined, used for primary filtering
- Tags — free-form keywords added by sellers, used for search and discovery
- An item belongs to exactly 1 category and can have 0–10 tags

**Structure:** Flat list (v1). No hierarchy, no subcategories. Tree structure deferred to future if needed.

**12 categories (confirmed):**
- Electronics
- Clothing & Accessories
- Antiques & Collectibles
- Home & Garden
- Sports & Outdoors
- Vehicles & Parts
- Books & Media
- Musical Instruments
- Toys & Hobbies
- Health & Beauty
- Building Materials
- Other

**Tag behaviour:**
- Autocomplete from existing tags as seller types (GET /api/v1/tags?q=ww2)
- If no match → seller can create a new tag on the fly
- Tags normalized on save: trimmed, lowercased, deduplicated
- Prevents duplicates like "ww2", "WW2", "World War 2" all existing separately

**Extensibility:**
- All categories managed in DB — no code change needed to add/edit/remove
- Tags stored in a `Tags` table with many-to-many join to Items
- Future: tag popularity ranking, admin tag merging tool (merge "ww2" + "wwii" → one canonical tag)
- Future: category tree (add ParentId, Slug, IconName) if subcategories are needed

---

## 5. Data Models

```
User
  - Id (uuid)
  - Email
  - PasswordHash
  - DisplayName
  - AvatarUrl
  - Bio
  - Location
  - MaxItems (int, default 10)      ← item listing limit; set manually in DB for v1, purchasable in future
  - IsActive (bool, default true)   ← soft delete / ban support
  - CreatedAt

Shop
  - Id (uuid)
  - OwnerId → User  [unique index — 1 shop per user enforced at API level]
  - Name
  - Description
  - BannerImageUrl
  - ContactWhatsApp (string, nullable)
  - ContactEmail (string, nullable)
  - ContactFacebook (string, nullable)
  - ContactOther (string, nullable)    ← free text, e.g. "Telegram: @username"
  - CreatedAt
  NOTE: FK is one-to-many in DB to allow future multi-shop expansion
  NOTE: at least one contact method required at shop creation
  NOTE: MaxItems moved to User model (v1 items are user-level, not shop-level)

Category  (flat list, v1)
  - Id (int)
  - Name
  - SortOrder (int, default 0)         ← controls display order in dropdown
  NOTE: flat list for v1. Tree structure (ParentId, Slug, IconName) deferred to future.
  NOTE: 12 categories seeded on first migration

Tag
  - Id (int)
  - Name           ← lowercase, normalized

Item
  - Id (uuid)
  - UserId → User
  - StallId → Stall (nullable)              ← items belong to a stall
  - CategoryId → Category
  - Title
  - Description
  - Condition (enum: New / LikeNew / Good / Fair / Poor)
  - Price (decimal, nullable)                ← listed/asking price (optional)
  - AcceptOffers (bool, default false)       ← whether buyers can make offers
  - MinOfferPrice (decimal, nullable)        ← floor price for offers
  - OfferStep (decimal, nullable)            ← minimum increment between offers
  - EndDate (DateTime, nullable)             ← when offers close (timed items)
  - Visibility (enum: Public / RegisteredOnly / LinkOnly / Private, default: Public)
  - Location (string, nullable)              ← Nominatim autocomplete, stores "City, Country"
  - CanShip (bool, default false)            ← local pickup vs shipping
  - IsSold (bool, default false)             ← auto-set by AuctionEndedService for timed items
  - SortOrder (int, default 0)              ← custom ordering within stall
  - CreatedAt
  - UpdatedAt
  NOTE: no PricingType enum — type derived from field combination (price-only, offers, timed, etc.)
  NOTE: must have Price OR AcceptOffers=true (cannot have neither)
  NOTE: no Status enum for v1. Seller removes item when done. Ended items derived from EndDate < now.
  NOTE: item count enforced against User.MaxItems at API level

ItemImage
  - Id (uuid)
  - ItemId → Item
  - Url (string)
  - SortOrder (int)                          ← controls display order
  - IsPrimary (bool)                         ← cover image shown in listings
  NOTE: max 5 images per item enforced at API level

ItemTag  (join table)
  - ItemId → Item
  - TagId → Tag

Bid
  - Id (uuid)
  - ItemId → Item
  - UserId → User
  - Amount (decimal)
  - Status (enum: Active=0, Denied=1, InstantBuy=2)
  - IsInstantBuy (bool, default false)       ← persists through status changes (tracks origin)
  - DenyReason (string, nullable)            ← reason code when denied
  - DenyDetail (string, nullable)            ← free text detail (for "other" reason)
  - DeniedAt (DateTime, nullable)
  - CreatedAt
  RULE: 1 active bid per user per item (update-in-place — new bid replaces old)
  NOTE: All bidders are registered users
  NOTE: InstantBuy: buyer pays listed price, seller accepts/declines. Bid stays InstantBuy status after acceptance.
  NOTE: Timed auctions: highest bid wins when EndDate passes (AuctionEndedService auto-sells)
  NOTE: Anti-snipe: bids in last 10 min of timed auction extend EndDate by 10 min
  NOTE: Deny reasons: fake_or_accidental, dont_trust, other, instant_buy_declined, sale_reopened, passed_to_next, auction_closed

Notification
  - Id (uuid)
  - UserId → User                        ← notification recipient (Cascade delete)
  - Type (enum: NewBid=0 / AuctionEnded=1 / BidAccepted=2 / NewItemFromFollowed=3 / BidDenied=4 / ItemDeleted=5 / BidWon=6 / InstantBuyRequested=7 / InstantBuyAccepted=8 / InstantBuyDeclined=9 / AuctionReopened=10 / AuctionClosed=11)
  - ActorId → User (nullable)            ← who triggered it (SetNull — preserved if actor deleted)
  - ItemId → Item (nullable)             ← related item (SetNull — preserved if item deleted)
  - BidId → Bid (nullable)               ← related bid (SetNull — preserved if bid deleted)
  - IsRead (bool, default false)
  - GroupCount (int, default 1)           ← for throttled notifications (e.g. "X posted 3 new items")
  - CreatedAt
  INDEX: (UserId, IsRead, CreatedAt) — paginated listing
  INDEX: (UserId, Type, ActorId, IsRead) — throttle dedup check
  NOTE: 90-day retention via NotificationCleanupService (BackgroundService, 24h cycle)
  NOTE: SetNull FKs preserve notification history when related entities are deleted
```

---

## 6. Architectural Decisions Log

| # | Decision | Reason | Date |
|---|---|---|---|
| 1 | Next.js for frontend | SSR needed for SEO on item listing pages | 2026-03-17 |
| 2 | ASP.NET Core for API | Developer familiarity with C#/.NET | 2026-03-17 |
| 3 | PostgreSQL + EF Core | Relational data, code-first migrations | 2026-03-17 |
| 4 | Railway for hosting | Simpler than Azure for early stage | 2026-03-17 |
| 5 | SignalR for real-time | Built into ASP.NET Core, no extra infra | 2026-03-17 |
| 6 | No payments in v1 | Reduces scope and legal complexity | 2026-03-17 |
| 7 | Price not required on listings | Core product differentiator | 2026-03-17 |
| 8 | 1 shop per user (v1) | Simpler UX; DB supports multi-shop for future | 2026-03-17 |
| 9 | Item Visibility enum (Public/RegisteredOnly/LinkOnly/Private) | Boolean too limiting; enum covers all future visibility cases cleanly | 2026-03-17 |
| 10 | Categories (fixed) + Tags (free-form) | Structured browsing + flexible discovery | 2026-03-17 |
| 11 | ~~Category tree~~ → Flat category list (v1) | Simplified: 12 categories in a flat dropdown. Tree structure deferred. See #36. | 2026-03-17 |
| 12 | Tags: autocomplete + allow new, normalized on save | Prevents duplicates, keeps tag DB clean, good UX (Stack Overflow style) | 2026-03-17 |
| 13 | On offer accept → other offers silently declined, no notification | Clean UX — buyer only notified on accept, not on silent decline | 2026-03-17 |
| 14 | One active offer per buyer per item — new offer replaces old | Simpler than multiple simultaneous offers, avoids confusion | 2026-03-17 |
| 15 | Optional minimum offer price on listings | Seller control without fixed price — keeps offer-based model intact | 2026-03-17 |
| 16 | ItemImage as separate table (not array of urls on Item) | Enables sort order, primary image, per-image deletion | 2026-03-17 |
| 17 | Currency field on Offer (default EUR) | Zero-cost to add now, avoids breaking migration for multi-currency later | 2026-03-17 |
| 18 | IsActive on User (soft delete) | Needed for future ban/deactivation without losing relational data | 2026-03-17 |
| 19 | CounterPending added to Offer status enum | Full counter-offer loop: seller counters → buyer accepts/declines | 2026-03-17 |
| 20 | shadcn/ui for UI components | Saves weeks on boilerplate, owns the code, Radix accessibility, perfect for tag combobox + offer dialogs + toasts | 2026-03-17 |
| 21 | Default currency EUR | Platform targets European market; field exists for future multi-currency | 2026-03-17 |
| 22 | JWT — long-lived token (7 days), no refresh | Simpler for v1; acceptable risk at early stage | 2026-03-17 |
| 23 | API versioning /api/v1/... from day one | Cheap to add now, painful to retrofit later | 2026-03-17 |
| 24 | Offset-based pagination (page + size) | Simpler for v1; good enough at early scale | 2026-03-17 |
| 25 | Frontend state management — deferred | Will decide at Phase 2 based on actual complexity needs | 2026-03-17 |
| 26 | Serilog → Railway logs for monitoring | Zero config, catches production issues early | 2026-03-17 |
| 27 | Post-acceptance contact via external channels (v1) | No built-in messaging in v1 — buyer sees seller contact info (WhatsApp/email/Facebook) + item ID to arrange deal offline | 2026-03-17 |
| 28 | Contact details stored on Shop, not User | Seller controls which channels to expose per shop | 2026-03-17 |
| 29 | Mobile-first design throughout | Marketplace users primarily browse on phone; build mobile-first, enhance for desktop | 2026-03-17 |
| 30 | Anonymous offers supported (seller opt-in per item) | Lower barrier to buy = more offers; seller controls exposure | 2026-03-17 |
| 31 | Anonymous offer contact stored as snapshot on Offer | No account needed; contact (phone/email/messenger) captured at offer time, visible to seller immediately | 2026-03-17 |
| 32 | Contact blacklist deferred to post-v1 | Blacklist targets contact values not accounts; noted for future, not blocking v1 | 2026-03-17 |
| 33 | ~~Free tier 10 items per shop~~ → MaxItems on User | Moved from Shop to User (no shops in v1). Default 10, manually adjustable in DB. Future: purchasable. See #39. | 2026-03-18 |
| 34 | Monetization deferred to post-v1 | Tiered plans (Basic/Pro) likely model; need real users before deciding pricing. DB ready with MaxItems field. | 2026-03-18 |
| 35 | UI/UX pages designed separately | Every frontend page gets its own design discussion before implementation — no rushed UI | 2026-03-18 |
| 36 | Flat categories (no tree) for v1 | Prototype uses simple dropdown with 12 categories. Tree adds complexity with no current benefit. Add ParentId/Slug later if needed. | 2026-03-27 |
| 37 | PricingType enum on Item | Prototype designed 4 pricing modes (Fixed/FixedOffers/Bidding/Auction) each with different fields. Replaces single MinimumOfferPrice. | 2026-03-27 |
| 38 | Item → User (not Shop) for v1 | Shop management (Phase 3) not built yet. Items link to User directly. Migrate to ShopId when Phase 3 is implemented. | 2026-03-27 |
| 39 | MaxItems on User (not Shop) | Item limit is per-user for v1. Default 10, manually set in DB. Future: purchasable upgrades. Moves to Shop when Phase 3 is built. | 2026-03-27 |
| 40 | No item Status enum for v1 | No sold history, no "Under Offer". Seller removes item when done. Ended auctions derived from AuctionEnd < now. | 2026-03-27 |
| 41 | Item location via Nominatim | OpenStreetMap Nominatim autocomplete (free, global, no API key). Stores "City, Country" string. Pre-filled from user profile. | 2026-03-27 |
| 42 | AllowAnonymousOffers → AllowGuestOffers | Renamed for clarity. "Guest" = unregistered user. | 2026-03-27 |
| 43 | ~~PricingType enum~~ → Composable pricing fields | Replaced 4-value enum with AcceptOffers + Price + MinOfferPrice + OfferStep + EndDate. Type derived from field combination. More flexible, no artificial limits. | 2026-05-07 |
| 44 | 5-condition enum (New/LikeNew/Good/Fair/Poor) | Replaced 3-value (New/Used/Worn). Gives buyers better signal on item quality. Data migration: Used→Good, Worn→Poor. | 2026-05-07 |
| 45 | Unified item form (add + edit) | Single 3-tab component (Details, Pricing, Terms) used by both add wizard and edit modal. Eliminates code duplication. | 2026-05-07 |
| 46 | Countdown delete confirmation | 3s countdown for normal items, 5s for items with active offers. Prevents accidental deletion without friction for intentional deletes. | 2026-05-07 |
| 47 | 3-layer in-form help system | Inline hints (always visible), HelpPopover (?) for complex fields with examples, dismissible TipsBanner per tab. Cookie-persisted dismissal, re-enable toggle in sidebar. | 2026-05-07 |
| 48 | Tips dismissal in cookie (not localStorage) | SSR-aware, consistent with theme/language storage pattern. Permanent dismiss with re-enable toggle — no per-session dismiss to avoid "cookie banner" annoyance. | 2026-05-07 |
| 49 | Single AppHub for messages + notifications | Renamed ChatHub → AppHub. Single SignalR connection per client reduces overhead. Both UnreadCountChanged and NotificationCountChanged events on same hub. | 2026-05-15 |
| 50 | SetNull FKs on Notification (Actor, Item, Bid) | Notifications survive deletion of referenced entities. User sees "deleted item" gracefully instead of losing notification history. UserId FK is Cascade (delete user → delete their notifications). | 2026-05-15 |
| 51 | 90-day notification retention + daily cleanup | Prevents unbounded table growth. BackgroundService with EF Core batch delete (1000/batch). Acceptable for marketplace scale. | 2026-05-15 |
| 52 | Follower notification throttling (1hr dedup) | Same seller posting multiple items quickly → single "X posted N items" notification instead of spam. Check: unread + same actor + same type + within 1 hour → increment GroupCount. | 2026-05-15 |
| 53 | ~~Accept/deny/complete/fail~~ → Bid deny + Instant Buy | Replaced 6-state workflow. Seller can deny bidders (with reasons). Instant Buy for immediate purchase at listed price. Timed auctions auto-sell. Sold state has manage actions (cancel deal / pass to next / close auction). | 2026-05-19 |
| 54 | ~~Anonymous bidding + guest offers~~ → All bidders registered | Every bidder has an account and is identified. Simplifies messaging. | 2026-05-15 |
| 55 | No contact info reveal | Seller contacts bidders via in-app messaging, never sees their email/phone. | 2026-05-15 |
| 56 | IsSold lifecycle | Timed: auto-set by AuctionEndedService. Instant Buy: set when seller accepts. Reversible via reopen (IB with time left) or close-auction (denies all). | 2026-05-19 |
| 57 | Instant Buy = item.Price | No separate InstantBuyPrice field. If item has Price + AcceptOffers, buyer sees Buy Now. Hidden when bids exceed the price. | 2026-05-19 |
| 58 | Sell-to-bidder = reversible sale | Seller sells to bidder via inline card expander (not auction close). Sale is reversible: deny winner → unsells → sell to another. Auction truly closes only via explicit "Close auction" footer button. | 2026-05-20 |
| 59 | Minimal notification model | Personal notifications only for bid events (Outbid, BidDenied, BidWon, IB accept/decline). Seller-only for NewBid/IBRequested. Broadcast only on final close (AuctionEnded/AuctionClosed). No fan-out on every bid. | 2026-05-20 |

---

## 7. Open Questions

- [x] ~~Confirm or adjust the starter root category list~~ → 12 flat categories confirmed (2026-03-27)
- [ ] Target market / geography? (Latvia? Europe? Global?)
- [ ] Public platform name / domain?
- [ ] Frontend state management — decide at Phase 2 (Zustand + TanStack Query vs simpler approach)
- [ ] Auction bidders list — prototype + implement view of users who placed bids
- [ ] Ended auction UX — readonly display, winner visible, full details TBD

## 8. Resolved Decisions (from open questions)

- [x] Tags: autocomplete from existing + allow new ones. Normalized on save (lowercase, trimmed). Future: admin tag merge tool.
- [x] Category structure: flat list for v1 (12 categories, dropdown). Tree deferred.
- [x] 1 shop per user (v1)
- [x] All 4 visibility levels active in UI (Public/RegisteredOnly/LinkOnly/Private)
- [x] No payments in v1
- [x] Offer accept → others silently declined
- [x] One active offer per buyer per item (new replaces old)
- [x] Optional minimum offer price on listings
- [x] Images as separate ItemImage table
- [x] Currency field on Offer (default EUR)
- [x] IsActive soft delete on User
- [x] CounterPending status in Offer enum
- [x] Default currency EUR
- [x] JWT long-lived 7 days, no refresh token in v1
- [x] API versioning /api/v1/... from day one
- [x] shadcn/ui for UI component library
- [x] Offset-based pagination (page + size) for v1
- [x] Frontend state management deferred to Phase 2
- [x] Serilog for logging → Railway logs
- [x] Post-acceptance flow: registered buyer gets seller contact details + item ID; anonymous buyer already provided contact at offer time
- [x] Anonymous offers — seller opt-in per item; contact snapshot stored on Offer
- [x] Contact blacklist — deferred post-v1
- [x] No built-in messaging in v1 — deferred to future
- [x] ~~PricingType enum~~ → Composable pricing fields (AcceptOffers + Price + MinOfferPrice + OfferStep + EndDate)
- [x] Item → User for v1 (not Shop) — migrate to ShopId in Phase 3
- [x] MaxItems on User (default 10) — manually set in DB for v1, purchasable in future
- [x] No item Status enum — seller removes when done, ended auctions derived from AuctionEnd
- [x] Item location via Nominatim autocomplete — stores "City, Country" string
- [x] 12 flat categories confirmed — Musical Instruments, Toys & Hobbies, Health & Beauty, Building Materials added to original 8

---

*This document is updated after every completed feature or major decision.*
*Paste this file at the start of a new conversation to restore full context.*
