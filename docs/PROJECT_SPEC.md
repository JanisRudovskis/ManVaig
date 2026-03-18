# ManVaig — Living Project Spec

> **Working directory:** `C:\GIT\ManVaig`
> **Last updated:** 2026-03-17 (rev 8 — anonymous offer flow added)
> **Status:** 🟢 Planning complete — ready for Phase 1 scaffolding

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
- 🕐 User registration (email + password)
- 🕐 User login / logout
- 🕐 JWT token auth
- 🕐 User profile page (avatar, bio, location)
- 💡 OAuth (Google / Facebook login)
- 💡 Email verification

### Shop Management
- 🕐 Create a shop (name, description, banner image) — 1 shop per user
- 🕐 Edit shop details
- 🕐 View own shop dashboard
- 🕐 Public shop page (visible to all)
- 💡 Shop ratings / reviews
- 💡 Featured shops
- 💡 Multiple shops per user (DB supports it, UI limited to 1 for now)

### Item Listings
- 🕐 Add item (title, description, category, tags, images, condition)
- 🕐 Edit / delete item
- 🕐 Item detail page — public only
- 🕐 Item status: Available / Under offer / Sold
- 🕐 Image upload (max 5 per item, compressed)
- 🕐 Category system (predefined main categories + free-form tags)
- 🕐 Optional minimum offer price per item
- 🕐 Item location (free text) + can ship flag
- 🕐 Allow anonymous offers toggle per item (default off)
- 💡 Private / unlisted items (IsPublic column in DB, UI hidden for now)
- 💡 Advanced filters (price range, condition, location)

### Offer System
- 🕐 Make an offer on an item (price + optional message)
- 🕐 Anonymous offers — no registration required (if seller enables per item)
- 🕐 Anonymous offer popup — collect phone / email / messenger + optional notes (min 1 required)
- 🕐 Enforce minimum offer price if set by seller
- 🕐 Block seller from making offer on own item (API guard)
- 🕐 New offer from same buyer replaces previous — registered users only (anonymous always new)
- 💡 Contact blacklist — block specific phone/email/messenger values from making offers
- 🕐 Shop owner receives offer notification (SignalR + email)
- 🕐 Owner can accept / decline / counter offer
- 🕐 Counter offer → buyer receives CounterPending notification, can accept or decline
- 🕐 On accept → all other pending offers silently declined
- 🕐 On item deletion → all pending offers cancelled, no notification sent
- 🕐 Offer history visible to item owner
- 🕐 On offer accepted → buyer sees seller contact details + item ID to arrange transaction
- 🕐 Item status set to Sold after acceptance
- 💡 Buyer offer status tracking dashboard
- 💡 Built-in messaging system (v2)
- 💡 Offer expiry (auto-decline after X days)

### Discovery
- 🕐 Homepage with latest items
- 🕐 Browse all items (paginated — offset, page + size)
- 🕐 Filter by main category
- 🕐 Filter / search by tags
- 💡 Full-text search
- 💡 Advanced filters (price range, condition, location)
- 💡 Trending items algorithm

### Notifications
- 🕐 In-app real-time notifications (SignalR)
- 🕐 Email on new offer received
- 💡 Email digest
- 💡 Push notifications

### Admin / Moderation
- 💡 Admin panel
- 💡 User ban system
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

**Structure:** Tree (adjacency list, self-referencing FK). Max 3 levels enforced in UI.

**Example tree:**
- Antiques → WW2 → Vehicles
- Antiques → WW2 → Uniforms
- Electronics → Phones → Smartphones

**Starter root categories (to be confirmed):**
- Electronics
- Clothing & Accessories
- Antiques & Collectibles
- Home & Garden
- Sports & Outdoors
- Vehicles & Parts
- Books & Media
- Other

**Tag behaviour:**
- Autocomplete from existing tags as seller types (GET /api/tags?q=ww2)
- If no match → seller can create a new tag on the fly
- Tags normalized on save: trimmed, lowercased, deduplicated
- Prevents duplicates like "ww2", "WW2", "World War 2" all existing separately

**Extensibility:**
- All categories managed in DB — no code change needed to add/edit/remove
- Tags stored in a `Tags` table with many-to-many join to Items
- Future: tag popularity ranking, admin tag merging tool (merge "ww2" + "wwii" → one canonical tag)

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

Category  (self-referencing tree, adjacency list)
  - Id (int)
  - Name
  - Slug                               ← e.g. "ww2" for /browse/antiques/ww2
  - ParentId → Category (nullable)     ← null = root category
  - SortOrder (int, default 0)         ← controls display order within siblings
  - IconName (string, nullable)        ← only used on root level in UI
  NOTE: DB supports unlimited depth. UI enforces max 3 levels (Root → Sub → Sub-sub)

Tag
  - Id (int)
  - Name           ← lowercase, normalized

Item
  - Id (uuid)
  - ShopId → Shop
  - CategoryId → Category
  - Title
  - Description
  - Condition (enum: New / Used / Worn)
  - Status (enum: Available / UnderOffer / Sold)
  - Visibility (enum: Public / RegisteredOnly / LinkOnly / Private, default: Public)
  - MinimumOfferPrice (decimal, nullable)    ← optional floor price, v1 feature
  - Location (string, nullable)              ← free text city/country
  - CanShip (bool, default false)            ← local pickup vs shipping
  - AllowAnonymousOffers (bool, default false) ← seller decides per item
  - CreatedAt
  - UpdatedAt

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

Offer
  - Id (uuid)
  - ItemId → Item
  - BuyerId → User (nullable)                ← null = anonymous offer
  - ContactPhone (string, nullable)          ← anonymous offers only
  - ContactEmail (string, nullable)          ← anonymous offers only
  - ContactMessenger (string, nullable)      ← anonymous offers only (FB / Telegram / etc.)
  - ContactNotes (string, nullable)          ← anonymous offers only
  - Amount (decimal)
  - Currency (string, default "EUR")         ← EUR always in v1, ready for multi-currency later
  - Message (string, nullable)
  - Status (enum: Pending / Accepted / Declined / Countered / CounterPending)
  - CounterAmount (decimal, nullable)
  - CreatedAt
  - UpdatedAt
  RULE: BuyerId OR at least one contact field must be present (enforced at API level)
  NOTE: one active offer per buyer per item (registered) — anonymous offers always create new
  NOTE: on accept → all other pending offers auto-declined silently, accepted buyer notified
  NOTE: for anonymous offers, contact info visible to seller immediately (no reveal step needed)

Notification
  - Id (uuid)
  - UserId → User
  - Type (enum: NewOffer / OfferAccepted / OfferDeclined / OfferCountered / CounterReceived)
  - ReferenceId (uuid, nullable)
  - Message (string)
  - IsRead (bool)
  - CreatedAt
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
| 11 | Category tree — adjacency list (self-referencing FK) | Simple, EF Core native, DB-managed, unlimited depth, UI capped at 3 levels | 2026-03-17 |
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

---

## 7. Build Order (MVP)

1. Project scaffolding — repo structure, Next.js init, ASP.NET Core init, DB connection
2. Auth — register, login, JWT
3. Shop — create, edit, public page
4. Items — add, edit, delete, public item page, categories + tags
5. Offers — make offer, receive/manage offers
6. Notifications — SignalR real-time + email
7. Homepage + Browse — listings feed, category filter, tag search
8. Polish — loading states, error handling, responsive design (mobile-first throughout)

---

## 8. Open Questions

- [ ] Confirm or adjust the starter root category list
- [ ] Target market / geography? (Latvia? Europe? Global?)
- [ ] Public platform name / domain?
- [ ] Frontend state management — decide at Phase 2 (Zustand + TanStack Query vs simpler approach)

## 9. Resolved Decisions (from open questions)

- [x] Tags: autocomplete from existing + allow new ones. Normalized on save (lowercase, trimmed). Future: admin tag merge tool.
- [x] Category structure: tree (adjacency list), DB-managed, UI max 3 levels
- [x] 1 shop per user (v1)
- [x] All items public (v1), visibility enum ready for future
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

---

*This document is updated after every completed feature or major decision.*
*Paste this file at the start of a new conversation to restore full context.*
