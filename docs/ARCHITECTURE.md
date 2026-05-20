# ManVaig — Architecture Guide

> How the project works. Updated after every completed feature.
> Last updated: 2026-05-20 (Sell-to-bidder: inline expandable cards with Sell/Message/Deny + 2-tap confirm. Sold state: BUYER/RUNNERS-UP grouping, buyer pill, close auction footer. Notification simplification: seller-only NewBid, personal-only Outbid/BidDenied/BidWon/IB, broadcast only on final close. Removed: pass-to-next, AuctionReopened broadcast, dead notification methods. Watcher count with eye icon.)

---

## Ports & URLs

| Service | URL | Config |
|---------|-----|--------|
| Backend API | `http://localhost:5100` | `Properties/launchSettings.json` |
| Frontend | `http://localhost:3000` (or 3001) | Next.js default |
| Frontend → API | `NEXT_PUBLIC_API_URL` env var | Defaults to `http://localhost:5100` in `lib/auth.ts` |
| CORS | `localhost:3000`, `localhost:3001` | `appsettings.json → Cors:AllowedOrigins` |

---

## Backend Architecture

### Entry Point: `Program.cs`

DI registration order: EF Core → Identity → JWT → CORS → Resend → Cloudinary/ImageService → NotificationService → BackgroundServices → Controllers

Middleware pipeline includes `LastSeenMiddleware` — updates `LastSeenAt` on authenticated requests (throttled to once per 5 minutes to avoid DB writes on every request).

- `AppDbContext` — Npgsql, connection string from `ConnectionStrings:DefaultConnection`
- Identity config: `RequireDigit=true, RequiredLength=8, RequireNonAlphanumeric=false, RequireUniqueEmail=true`
- JWT: reads `Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpirationDays` from config
- Resend: `ResendClient` via HttpClient, API key from `Resend:ApiKey`
- DI: `IEmailService → ResendEmailService` (transient)
- Cloudinary: `CloudinaryImageService` via `IImageService` (singleton), graceful no-op if credentials missing


### Database: `Data/AppDbContext.cs`

- Extends `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>`
- Custom entity config: field length constraints on ApplicationUser
- All Identity tables (AspNetUsers, AspNetRoles, etc.) managed by Identity

### Model: `Models/ApplicationUser.cs`

Extends `IdentityUser<Guid>` — inherits `Id`, `Email`, `UserName`, `EmailConfirmed`, `PasswordHash`, etc.

Custom fields: `DisplayName` (unique username, 3-30 chars, `[a-zA-Z0-9_-]`), `AvatarUrl`, `Bio`, `Location`, `Phone`, `TelegramUsername`, `IsProfilePublic` (default true), `EnabledChannels` (flags enum: WhatsApp=1, Telegram=2, ShowEmail=4, ShowPhone=8), `IsActive` (bool), `CreatedAt`, `LastEmailSentAt` (nullable, for rate limiting), `LastSeenAt` (nullable, updated by middleware), `LastPhoneChangedAt` (nullable, for phone change rate limiting)

Navigation properties: `UserBadges`, `DisplayedBadges`

### Badge System

Three tables:
- `BadgeDefinition` — catalog (Id, Key unique, Name, Description, IconUrl). Seeded with "top_1000".
- `UserBadge` — which badges a user has earned (composite key: UserId+BadgeDefinitionId)
- `UserDisplayedBadge` — which 3 badges the user chose to show (composite key + SortOrder 0-2)

### DTOs: `Models/Dto/AuthDtos.cs`

- `RegisterRequest` — Email, Password, DisplayName, Language?
- `LoginRequest` — Login (email or username), Password
- `AuthResponse` — Token, ExpiresAt, UserId, Email, DisplayName, EmailConfirmed, AvatarUrl?
- `ConfirmEmailRequest` — UserId, Token
- `ForgotPasswordRequest` — Email, Language?
- `ResetPasswordRequest` — UserId, Token, NewPassword
- `ChangeEmailRequest` — NewEmail, Password, Language?

### DTOs: `Models/Dto/ProfileDtos.cs`

- `UserProfileResponse` — all profile fields + displayed badges (email/phone nulled for public view)
- `UpdateProfileRequest` — partial update: bio, location, phone, isProfilePublic, enabledChannels, displayedBadgeIds (max 3)
- `BadgeDto` — id, key, name, iconUrl

### Controller: `Controllers/V1/AuthController.cs`

All routes under `/api/v1/auth/`:

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `POST register` | Public | Validates unique username format, creates user, sends bilingual confirmation email, returns JWT |
| `POST login` | Public | Supports email or username login (contains `@` → email, else → username lookup). Checks `IsActive`, returns JWT |
| `POST confirm-email` | Public | Accepts `{userId, token}`, calls `ConfirmEmailAsync` |
| `POST resend-confirmation` | Bearer | Rate-limited (2 min via `LastEmailSentAt`), sends confirmation email. Returns 429 with `retryAfter` if too soon |
| `GET check-name` | Public | Real-time username availability check. Returns `{available, reason}` |
| `POST forgot-password` | Public | Always returns 200 (no email enumeration). In-memory rate limit per email (2 min). Sends bilingual reset email |
| `POST reset-password` | Public | Validates token, resets password |
| `POST change-email` | Bearer | Requires password verification. Validates email not taken. Rate-limited. Updates email, marks unconfirmed, sends confirmation, returns new JWT |
| `POST change-phone` | Bearer | Requires password verification. Rate-limited: verified phones can only be changed once per 30 days (tracked via `LastPhoneChangedAt`). Returns 400 `PHONE_CHANGE_TOO_SOON` with `nextChangeAt` if cooldown active. |

### Rate Limiting

Email sending is rate-limited to 1 email per 2 minutes:
- **Authenticated endpoints** (`resend-confirmation`, `change-email`): tracked via `LastEmailSentAt` field on `ApplicationUser`. Returns HTTP 429 with `retryAfter` seconds.
- **Unauthenticated endpoint** (`forgot-password`): in-memory `ConcurrentDictionary<string, DateTime>` keyed by normalized email. Silently skips sending (still returns 200 to prevent enumeration).

### JWT Claims

Token contains: `sub` (userId), `email`, `jti`, `displayName`, `emailConfirmed` (string `"true"`/`"false"`), `avatarUrl` (optional, only if set)

### Controller: `Controllers/V1/ProfileController.cs`

All routes under `/api/v1/`:

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `GET profile` | Bearer | Returns full profile (email, phone visible) |
| `PUT profile` | Bearer | Partial update (null fields skipped). Validates badge ownership. |
| `POST profile/avatar` | Bearer | Multipart upload, 2MB limit, resizes to 256x256 WebP, uploads to Cloudinary |
| `GET users/{displayName}` | AllowAnonymous | Public profile. Anonymous + private → limited response (avatar, name only). Authenticated + private → full profile. 404 only if user doesn't exist or inactive. |
| `GET users/{displayName}/listings` | AllowAnonymous | User's public listings (limit 1-20). Anonymous + private → empty array. Authenticated + private → normal listings. |

### Stalls System

**Model: `Models/Stall.cs`** — Name, Slug (unique-per-user), Description, ThumbnailUrl, HeaderImageUrl, BackgroundImageUrl, AccentColor, SortOrder, IsDefault, UserId. Plus 4-state `Visibility` (`StallVisibility` enum at `Models/Enums/StallVisibility.cs`: `Public=0, RegisteredOnly=1, LinkOnly=2, Private=3` — same integers as `ItemVisibility`). Plus 6 default-for-new-items fields: `DefaultCategoryId` (int? FK to Category), `DefaultLocation` (string?), `DefaultCanShip` (bool), `DefaultTagsJson` (string? — JSON-encoded list of tag names, max 10 × 30 chars), `DefaultCondition` (Condition?), `DefaultAcceptOffers` (bool). Multiple stalls per user. First-stall auto-default created by `ItemsController` when user creates an item without an explicit stall.

**Stall visibility composition** (most-restrictive wins, orthogonal axes — applies in `PublicStallsController`, `PublicItemsController`, `ProfileController`):
- `RegisteredOnly` → requires authenticated viewer
- `LinkOnly` → never appears in browse listings (only via direct URL)
- `Private` → only owner sees it
- **Browse** lists ONLY `stall.Visibility == Public AND item.Visibility == Public`. Other states are direct-link-only — including for authed users.
- **Item detail** (`GET /api/v1/public/items/{id}`) gates stall-visibility FIRST (Private → 404 non-owner; RegisteredOnly → 401 anon; LinkOnly/Public → fall through) then runs the existing item-visibility switch.
- **Constraint**: `IsDefault==true` requires `Visibility==Public`. API rejects with `IS_DEFAULT_REQUIRES_PUBLIC` to prevent the "default stall set to non-Public hides all items via auto-default-targeting" footgun.

**Controller: `Controllers/V1/StallsController.cs`**:
- CRUD: create, update, delete, list my stalls, get single stall
- `PUT /api/v1/stalls/reorder` — reorder stalls by ID array
- Background image upload/delete (Cloudinary)
- Delete protection: cannot delete last stall

**Items ↔ Stalls**: Items have optional `StallId`. `GET /api/v1/items` supports `?stallId=` filter + `?sort=newest|oldest|priceAsc|priceDesc|custom` parameter.

**Composable Pricing**: Items no longer use a `PricingType` enum. Instead, pricing is derived from composable fields:
- `Price` (decimal?) — listed/asking price
- `AcceptOffers` (bool) — whether buyers can make offers
- `MinOfferPrice` (decimal?) — floor for offers
- `OfferStep` (decimal?) — minimum increment between offers
- `EndDate` (DateTime?) — when offers close (timed items)

Valid combinations: price-only, price+offers, offers-only, any with end date (when offers enabled). Must have price OR acceptOffers enabled.

**Condition Enum**: 5 values — New(0), LikeNew(1), Good(2), Fair(3), Poor(4). Migrated from old 3-value (New/Used/Worn).

**Item Ordering**: `SortOrder` field on Item. `PUT /api/v1/items/reorder` endpoint (same pattern as stalls). Custom sort orders items by SortOrder then CreatedAt.

**Bid Summary on Items**: `ItemResponse` includes `BidCount`, `HighestBid`, `BiddingPaused`, `BiddingClosed` (computed from Bids navigation property, active bids only).

### Public Browse / Search

**Controllers** (anonymous, no `[Authorize]`):

| Endpoint | What it does |
|---|---|
| `GET /api/v1/public/items` (`PublicItemsController.Browse`) | Browse public items. Params: `page` (≥1), `pageSize` (1-50), `categoryId?`, `q?` (text search). Returns `PublicItemListResponse` with item cards (title, price, location, images, seller summary, bid summary). Filters to `Visibility == Public`. |
| `GET /api/v1/public/stalls` (`PublicStallsController.Browse`) | Browse public stalls. Params: `page`, `pageSize`, `q?`. Returns `PublicStallListResponse`. Only stalls with ≥1 public item. Each stall projects up to 4 preview image URLs from public items. Ordered by ItemCount desc, CreatedAt desc. |

**Search behavior** (`q` param, both endpoints):
- Trimmed, capped at 100 chars server-side before pattern construction (DoS guard).
- Pattern: `$"%{q}%"` applied via `EF.Functions.ILike(EF.Functions.Unaccent(field), EF.Functions.Unaccent(pattern))` on BOTH sides — folds Latvian diacritics so `riga` matches `Rīga`. Required Postgres extension: `unaccent` (added by `AddUnaccentExtension` migration: `CREATE EXTENSION IF NOT EXISTS unaccent;`).
- Items match against: `Title`, `Description`, `ItemTags.Tag.Name`.
- Stalls match against: `Stall.Name`, `Stall.Description`, `Stall.User.DisplayName`.
- No relevance ranking in v1 — `OrderByDescending(CreatedAt)` for items; `OrderBy(ItemCount desc, CreatedAt desc)` for stalls. Future: switch to `pg_trgm` or full-text (`tsvector`) once volume/index pressure warrants — current implementation bypasses indexes due to `unaccent()` on indexed columns.

### Bidding System

**Model: `Models/Bid.cs`** — ItemId, UserId, Amount, Status (BidStatus enum: Active=0, Denied=1, InstantBuy=2), IsInstantBuy (bool, persists through status changes), DenyReason, DenyDetail, DeniedAt, CreatedAt. All bidders are registered users.

**Controller: `Controllers/V1/BidsController.cs`**:

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `GET /items/{itemId}/bids` | Public | Bid list (active + instant buy + denied). Returns `soldTo`, `canReopen`, `instantBuyPrice`, `pendingInstantBuy`, `watcherCount`. |
| `POST /items/{itemId}/bids` | Bearer | Place bid. Update-in-place (1 active per user). Validates step/min. Rejects if user has pending instant buy. Notifies seller (NewBid) + previous top bidder (Outbid). |
| `POST /items/{itemId}/instant-buy` | Bearer | Instant buy at item.Price. Creates bid with Status=InstantBuy. Rejects if already pending or bids ≥70% of price. Notifies seller (InstantBuyRequested). |
| `POST /items/{itemId}/instant-buy/accept` | Bearer (seller) | Accepts instant buy → IsSold=true. Notifies buyer only (InstantBuyAccepted). |
| `POST /items/{itemId}/instant-buy/decline` | Bearer (seller) | Denies instant buy bid → bidding continues. Notifies buyer only (InstantBuyDeclined). |
| `POST /items/{itemId}/sell-to/{bidderId}` | Bearer (seller) | Sell item to specific bidder → IsSold=true. Notifies winner only (BidWon). |
| `POST /items/{itemId}/reopen` | Bearer (seller) | Cancel sale (instant buy failed). Denies winner bid, sets IsSold=false. Only for IB sales with time remaining. Notifies prior buyer only (InstantBuyDeclined). |
| `POST /items/{itemId}/close-auction` | Bearer (seller) | Close auction permanently. Denies all bids, sets AcceptOffers=false. Notifies all subscribers (AuctionClosed). |
| `POST /items/{itemId}/bidders/{bidderId}/deny` | Bearer (seller) | Deny all active/IB bids from a bidder. If winner denied on sold item → unsells. Notifies denied bidder only (BidDenied). |
| `POST /items/{itemId}/subscribe` | Bearer | Subscribe to bid notifications. |
| `DELETE /items/{itemId}/subscribe` | Bearer | Unsubscribe. |

**Instant Buy flow**:
1. Buyer clicks "Buy Now" → InstantBuy bid created at item.Price → seller notified
2. Bidding continues normally (not locked), Buy Now button disabled for everyone
3. Seller accepts → IsSold=true, buyer notified
4. Seller declines → bid denied, bidding continues, buyer notified
5. Buy Now hidden when bids reach 70% of listed price

**Sell-to-bidder flow** (seller popup, inline expandable cards):
- Each bidder card expands on tap → 3 buttons: Sell (emerald) / Message / Deny
- Sell → 2-tap confirm (3s auto-reset) → calls `sellToBidder` → IsSold=true
- Denying the winner → unsells item → seller can sell to another bidder
- Cards expandable: non-timed = always, timed = only after end date passes

**Sold state** (seller popup):
- SoldHero with diagonal SOLD stamp + emerald price + clickable winner name
- Bidder list split: BUYER section (emerald card, BUYER pill, "Sold for €X") + RUNNERS-UP section (dimmed, no expansion)
- Winner card expandable with Message + Deny (deny unsells)
- Close auction footer: amber "Close auction" (sold) / red "Close without winner" (not sold) with confirmation modal

**Notification model** (minimal):
- **Personal only**: Outbid, BidDenied, BidWon, InstantBuyAccepted/Declined
- **Seller only**: NewBid, InstantBuyRequested
- **Broadcast (all subscribers)**: only on final close — AuctionEnded (timer) or AuctionClosed (manual)

**Item sold lifecycle**:
- **Timed items**: `AuctionEndedService` detects EndDate passed → sets `IsSold=true` → notifies all subscribers + winner
- **Instant buy**: buyer initiates, seller accepts → `IsSold=true` (reversible — seller can deny winner)
- **Sell to bidder**: seller picks a bidder → `IsSold=true` (reversible)
- **Sold items**: hidden from public feeds, seller sees SoldHero + expandable winner card

**Seller ↔ bidder communication**: Message button inside expandable bidder cards → routes to /messages.

### Follow System

**Model: `Models/UserFollow.cs`** — FollowerId + FolloweeId (composite PK), CreatedAt. Two FKs to ApplicationUser (Cascade on Follower, Restrict on Followee). Index on FolloweeId.

**Controller: `Controllers/V1/FollowController.cs`**:

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `POST /api/v1/users/{displayName}/follow` | Bearer | Follow a user. Idempotent. Cannot follow self. Race condition handled (DbUpdateException catch). |
| `DELETE /api/v1/users/{displayName}/follow` | Bearer | Unfollow a user. Idempotent. |
| `GET /api/v1/users/{displayName}/followers` | AllowAnonymous | Paginated follower list. Private profile + anonymous → empty. |
| `GET /api/v1/users/{displayName}/following` | AllowAnonymous | Paginated following list. Private profile + anonymous → empty. |

ProfileController extended: `followerCount`, `followingCount`, `isFollowedByMe`, `completedDealCount` added to UserProfileResponse.

### Messaging System (SignalR)

**Models:** `Conversation` (Id, User1Id, User2Id, CreatedAt, LastMessageAt) + `Message` (Id, ConversationId, SenderId, Text max 2000, IsRead, CreatedAt). One conversation per user pair — deduplication via normalized Guid order (smaller Guid = User1Id) + unique constraint on `(User1Id, User2Id)`.

**SignalR Hub: `Hubs/AppHub.cs`** (renamed from ChatHub) — JWT auth via query string (`OnMessageReceived` event extracts `access_token` from `/hubs/app` requests). On connect: auto-joins `user_{userId}` group. Methods: `JoinConversation(id)` (DB-validated participant check), `LeaveConversation(id)`. Server events: `ReceiveMessage`, `MessagesRead`, `UnreadCountChanged`, `NotificationCountChanged`.

**Controller: `Controllers/V1/ConversationsController.cs`**:

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `GET /api/v1/conversations` | Bearer | Inbox — paginated conversations sorted by LastMessageAt. Includes other user info, last message preview, unread count per conversation. |
| `GET /api/v1/conversations/{id}/messages` | Bearer | Paginated messages (newest first). Validates participant. |
| `POST /api/v1/conversations` | Bearer | Start or get existing conversation. Body: `{ participantId }`. Target must have public profile. Cannot message self. |
| `POST /api/v1/conversations/{id}/messages` | Bearer | Send message. Rate limited: 20/min sliding window. Broadcasts via SignalR to conversation group + updates other user's unread count. |
| `POST /api/v1/conversations/{id}/read` | Bearer | Mark all messages as read (where sender != current user). Broadcasts MessagesRead event. |
| `GET /api/v1/conversations/unread-count` | Bearer | Total unread count for top bar badge. |

**Program.cs changes:** `builder.Services.AddSignalR()`, `.AllowCredentials()` on CORS, `app.MapHub<AppHub>("/hubs/app")`. DI: `INotificationService → NotificationService` (scoped), `AuctionEndedService` + `NotificationCleanupService` (hosted).

**Rate limiting:** In-memory `ConcurrentDictionary<Guid, List<DateTime>>` with sliding window (60s). Periodic cleanup removes empty entries. Returns 429 with `retryAfter`.

### Notification System

**Model: `Models/Notification.cs`** — UserId, Type (NotificationType enum), ActorId? (nullable FK → User, SetNull), ItemId? (nullable FK → Item, SetNull), BidId? (nullable FK → Bid, SetNull), IsRead, GroupCount, CreatedAt. SetNull FKs preserve notifications even when actor/item/bid is deleted.

**NotificationType Enum** (`Models/Enums/NotificationType.cs`): NewBid(0), AuctionEnded(1), ~~BidAccepted(2)~~, NewItemFromFollowed(3), BidDenied(4), ItemDeleted(5), BidWon(6), InstantBuyRequested(7), InstantBuyAccepted(8), InstantBuyDeclined(9), ~~AuctionReopened(10)~~, AuctionClosed(11), Outbid(12). Struck types kept in enum for DB compat but never sent.

**Model: `Models/ItemSubscription.cs`** — Id, ItemId (FK → Item, Cascade), UserId (FK → User, Cascade), IsActive (bool, default true), CreatedAt. Unique index on (ItemId, UserId). Tracks notification opt-in/out per user per item. Owners subscribed by default (no row = subscribed). Unsubscribe sets IsActive=false (keeps row to distinguish "never subscribed" from "explicitly unsubscribed").

**Service: `Services/NotificationService.cs`** — Scoped service implementing `INotificationService`. Methods:
- `NotifyNewBid(sellerId, bidderId, itemId, bidId)` — direct seller notification
- `NotifyNewBidToSubscribers(sellerId, bidderId, itemId, bidId)` — fan-out: notifies active subscribers + seller (if no explicit opt-out). Excludes bidder.
- `NotifyAuctionEnded(sellerId, itemId)` — direct seller notification
- `NotifyAuctionEndedToSubscribers(itemId, sellerId)` — fan-out: notifies active subscribers + seller (if no explicit opt-out)
- `NotifyBidAccepted(bidderId, itemId, bidId)` — legacy winner notification
- `NotifyBidWon(winnerId, itemId, bidId)` — new: winning bidder notification (BidWon type)
- `NotifyNewItemFromFollowed(sellerId, itemId)` — queries UserFollows for followers, **throttle check**: unread + same actor + within 1 hour → increment GroupCount instead of creating new notification. Broadcasts `NotificationCountChanged` via SignalR per follower.
- `NotifyBidDenied(bidderId, itemId, bidId, reason)` — denied bidder notification
- `NotifyItemDeleted(itemId, sellerId, itemTitle)` — notifies active subscribers (excl seller). Stores item title in DenyReason field since item FK will be nulled by cascade.
- `NotifyInstantBuyRequested(sellerId, buyerId, itemId)` — seller only: someone wants to buy instantly
- `NotifyInstantBuyAccepted(buyerId, itemId)` — buyer only: your instant buy was accepted
- `NotifyInstantBuyDeclined(buyerId, itemId)` — buyer only: your instant buy was declined
- `NotifyOutbid(prevTopBidderId, newBidderId, itemId, newBidId)` — previous top bidder only: you've been outbid
- `NotifyAuctionClosedToSubscribers(itemId, sellerId)` — all subscribers: auction closed, no winner

**BackgroundService: `Services/AuctionEndedService.cs`** — Polls every 60s for items with EndDate ≤ now + AcceptOffers + no existing AuctionEnded notification (NOT EXISTS subquery). Uses subscriber fan-out (NotifyAuctionEndedToSubscribers) + NotifyBidWon for winning bidder. Uses `IServiceScopeFactory` (Singleton needing Scoped DbContext). `SemaphoreSlim(1,1)` non-blocking guard prevents tick overlap. 10s startup delay.

**BackgroundService: `Services/NotificationCleanupService.cs`** — Runs every 24h. Deletes notifications older than 90 days using EF Core LINQ (RemoveRange + SaveChanges in batches of 1000).

**Controller: `Controllers/V1/NotificationsController.cs`** — All `[Authorize]`:

| Endpoint | What it does |
|----------|-------------|
| `GET /api/v1/notifications?page=&pageSize=` | Paginated notifications (newest first). Joins Actor (displayName, avatar), Item (title, primary image URL), Bid (amount). |
| `POST /api/v1/notifications/read-all` | Mark all unread as read. Broadcasts `NotificationCountChanged(0)` via SignalR. |
| `GET /api/v1/notifications/unread-count` | Count of unread notifications for bell badge. |

**SignalR Hub: `Hubs/AppHub.cs`** (renamed from ChatHub) — Single hub at `/hubs/app` serving both messaging and notifications. JWT auth via query string. On connect: auto-joins `user_{userId}` group. Server events: `ReceiveMessage`, `MessagesRead`, `UnreadCountChanged` (messages), `NotificationCountChanged` (notifications).

**DB Indexes** (on Notifications table): `(UserId, IsRead, CreatedAt)` for paginated listing, `(UserId, Type, ActorId, IsRead)` for throttle dedup check.

### Image Service: `Services/CloudinaryImageService.cs`

- Implements `IImageService.UploadAvatarAsync(stream, fileName, userId)`
- Also: `UploadItemImageAsync` (800px max, WebP q80), `UploadStallBackgroundAsync`
- SixLabors.ImageSharp: resize to 256x256 (avatar) / 800px max (items), center crop, encode as WebP (quality 80)
- Uploads to Cloudinary as `manvaig/avatars/{userId}` or `manvaig/items/{itemId}`, returns secure URL
- Gracefully handles missing Cloudinary credentials (logs warning, throws on upload attempt)

### Email Service: `Services/ResendEmailService.cs`

- Implements `IEmailService` with bilingual support (EN/LV):
  - `SendEmailConfirmationAsync(email, confirmationLink, language)` — "Welcome to ManVaig" / "Laipni lūgti ManVaig!"
  - `SendPasswordResetAsync(email, resetLink, language)` — reset password with 24h expiry note
- Language detection: `IsLatvian(string language)` helper, defaults to English
- Styled HTML emails with branded purple (#7c6af7) CTA button
- Catches exceptions silently (registration/password-reset succeeds even if email fails)
- `FromEmail` from `Resend:FromEmail` config

### Config Files

- `appsettings.json` — tracked in git, has empty `Resend:ApiKey`, local DB connection string
- `appsettings.Development.json` — gitignored, has real Resend API key + Cloudinary keys
- Production will need env vars for: DB connection, JWT secret, Resend API key, Cloudinary credentials

---

## Frontend Architecture

### Provider Tree (`app/layout.tsx`)

```
html (lang={locale} from cookie)
  └─ NextIntlClientProvider (loads messages/{locale}.json)
      └─ ThemeProvider (next-themes, class-based, default=system)
          └─ TooltipProvider
              └─ AuthProvider (JWT state + login dialog)
                  └─ AppLayout
                      ├─ AppSidebar (collapsible, Claude-style)
                      └─ SidebarInset
                          ├─ TopBar (sticky, messages icon + unread badge)
                          └─ main > {children}
```

### i18n System

- Config: `src/i18n/config.ts` — `locales = ["en", "lv"]`, `defaultLocale = "en"`
- Request: `src/i18n/request.ts` — reads `NEXT_LOCALE` cookie, imports `messages/{locale}.json`
- Switching: `LanguageSwitcher` sets cookie + `router.refresh()` (full page re-render, no URL prefix)
- Translation files: `messages/en.json`, `messages/lv.json`
- Namespaces: `nav`, `home`, `language`, `theme`, `login`, `register`, `emailConfirmation`, `emailManagement`, `passwordChecklist`, `usernameChecklist`, `forgotPassword`, `resetPassword`, `profile`, `items`, `itemForm`, `stalls`, `feed`, `itemDetail`, `search`, `common`, `help`, `tips`, `offers`, `people`, `follow`, `myPage`, `messages`, `notifications`, `visibility`
- Plural-aware messages use ICU `{count, plural, one {…} other {…}}` (see `search.liveCountItems`, `search.liveCountStalls`)
- Rich text pattern: `t.rich("key", { tag: (chunks) => <Link>{chunks}</Link> })`

### Auth System

**`lib/auth.ts`** — API functions:
- `login(login, password)` → `AuthResponse` (login = email or username)
- `register(email, password, displayName, language?)` → `AuthResponse`
- `confirmEmail(userId, token)` → `{ message }`
- `resendConfirmation(language?)` → `{ message }` (Bearer, original function)
- `resendConfirmationWithRateLimit(language?)` → `{ message }` (Bearer, handles 429 with `retryAfter`)
- `checkDisplayName(name)` → `{ available, reason }` (public)
- `forgotPassword(email, language?)` → `{ message }` (public)
- `resetPassword(userId, token, newPassword)` → `{ message }` (public)
- `changeEmail(newEmail, password, language?)` → `AuthResponse` (Bearer, handles 429)
- `saveToken(token)` / `getToken()` / `logout()` — localStorage (`manvaig_token`)
- `getMyProfile()` → `UserProfile` (authorized)
- `updateProfile(data)` → `UserProfile` (authorized, partial update)
- `uploadAvatar(file)` → `{ avatarUrl }` (authorized, FormData)
- `getPublicProfile(displayName)` → `UserProfile` (sends auth token if available — authenticated users see full private profiles)
- `getUserListings(displayName, limit)` → `PublicItemCard[]` (sends auth token if available)
- `authFetch(url, options)` → `Response` (auto-attaches Bearer, auto-logout on 401)

**`lib/profile-utils.ts`** — shared helpers used by ProfileCard and ProfilePopup:
- `getLastSeenStatus(lastSeenAt, t)` → `{ text, isOnline }` — human-readable last-seen string with i18n
- `formatMemberDate(memberSince, locale)` → `string` — locale-aware "Month Year" formatting

**`lib/auth-context.tsx`** — React context:
- On mount: reads token from localStorage, parses JWT via `atob(token.split(".")[1])`
- Extracts: `sub`→userId, `email`, `displayName`, `emailConfirmed` (string→boolean), `avatarUrl` (optional)
- `isLoading` state prevents race conditions — pages wait for auth to initialize before checking `isLoggedIn`
- `useAuth()` exposes: `isLoggedIn`, `isLoading`, `user` (with `emailConfirmed`, `avatarUrl`), `openLoginDialog`, `setUser`, `updateAvatarUrl`, `logout`
- `updateAvatarUrl(url)` — updates avatar in context immediately after upload (no re-login needed)
- `LoginDialog` rendered inside `AuthProvider` — any component calls `openLoginDialog()` to trigger it

### Component Patterns

**Forms shared between page and dialog:**
- `LoginFormContent` — reusable form logic. Used by `LoginForm` (page at `/login`) and `LoginDialog` (modal).
- `RegisterFormContent` — reusable form. Used by `RegisterForm` (page at `/register`). After success, shows `EmailConfirmationPrompt` instead of redirecting.

**No browser-native validation:**
All `required`, `minLength`, `type="email"` removed. Custom `validate()` functions return i18n error strings. This ensures validation messages appear in the user's selected language.

**Sidebar (Instagram-style):** `AppSidebar` uses shadcn `Sidebar` with `collapsible="icon"`.
- Nav items defined as array, 24px icons (`size-6`), 48px tall buttons (`size="lg"`), `rounded-xl`
- Active items: bold text + thicker stroke (`strokeWidth={2.5}`)
- Footer: My Page link with `UserAvatar` (xs size) + `SidebarMoreMenu` popover
- `SidebarMoreMenu`: theme toggle, language sub-view (back navigation), logout. Replaces standalone ThemeToggle + LanguageSwitcher.
- Collapsed mode: `4rem` width (64px), `size-10` (40px) buttons, icons centered via padding
- Collapse/expand state persisted via `sidebar_state` cookie (read in `useEffect` to avoid hydration mismatch)
- Header: "ManVaig" logo + PanelLeftClose toggle (expanded) / PanelLeft toggle (collapsed)

### Pages (App Router)

| Route | Component | Type |
|-------|-----------|------|
| `/` | `app/page.tsx` | Homepage feed with category chips, infinite scroll |
| `/login` | `LoginForm` | Client component (email or username) |
| `/register` | `RegisterForm` → `EmailConfirmationPrompt` | Client component (with UsernameChecklist + PasswordChecklist) |
| `/confirm-email?userId=...&token=...` | `app/confirm-email/page.tsx` | Client component (context-aware: "Go to profile" if logged in) |
| `/forgot-password` | `app/forgot-password/page.tsx` | Client component (email form → success state) |
| `/reset-password?userId=...&token=...` | `app/reset-password/page.tsx` | Client component (new password + PasswordChecklist) |
| `/profile` | `ProfileCard` (inline edit) | Client component, auth required |
| `/user/[displayName]` | `ProfileCard` (read-only) | Client component, public |
| `/my-items` | `MyItemsPage` + `ItemForm` modal | Client component, auth required |
| `/my-stalls` | `MyStallsPage` | Stall list + create, auth required |
| `/my-stalls/[id]` | `StallItemsPage` | Stall items grid, activity badges, filters, reorder, edit stall |
| `/my-stalls/[id]/items/new` | `AddItemPage` | 2-step wizard: step 1 = describe (category, images, details), step 2 = pricing + terms (uses ItemForm) |
| `/items/[id]` | `app/items/[id]/page.tsx` | Public item detail page |
| `/search` | `app/search/page.tsx` (server, exports `metadata` with `robots: { index: false }`) + `app/search/search-client.tsx` ("use client" inside `<Suspense>`) | Unified search: Items|Stalls segmented tabs, ?q= debounced 300ms, min 2 chars, Enter skips debounce, hint chips, Load more pagination, plural-aware live region |
| `/people` | `app/people/page.tsx` (server, `noindex`) + `app/people/people-client.tsx` ("use client" inside `<Suspense>`) | People directory — search users by displayName. Anon: only public users; authed: all active users. Cards show avatar + displayName + member-since + "Active N ago" + contact-method icons. Entry from sidebar More menu, no top-level nav. |
| `/my-page` | `app/my-page/page.tsx` | Personal dashboard — profile summary, quick links (Edit Profile, My Stalls, My Items), followers/following tabs. Auth required. |
| `/messages` | `app/messages/page.tsx` | Inbox — conversation list sorted by last message time, unread indicators, skeleton loading, empty state. Auth required. |
| `/messages/[id]` | `app/messages/[id]/page.tsx` | Chat view — real-time via SignalR, message bubbles (own=blue right, theirs=muted left), read receipts (✓/✓✓), auto-scroll, mark-as-read, inline send errors. |
| `/notifications` | `app/notifications/page.tsx` | Full notification list — load-more pagination (20/page), item thumbnails (40px), relative time, error/retry state, login-required state, skeleton loading. Auth required. |

### Component Map

| Component | File | Purpose |
|-----------|------|---------|
| AppLayout | `components/app-layout.tsx` | SidebarProvider + SidebarInset wrapper + TopBar |
| TopBar | `components/top-bar.tsx` | Sticky header — mobile sidebar trigger + messages icon + notification bell with unread badges. |
| NotificationDropdown | `components/notification-dropdown.tsx` | Bell icon with red badge, Popover dropdown (base-ui). Lazy fetch on open, mark-all-read after API success, item thumbnails (32px) with UserAvatar fallback, relative time, "See all" link to /notifications. |
| FollowButton | `components/follow-button.tsx` | Follow/unfollow toggle with optimistic UI, tap-to-toggle on mobile |
| ConversationListItem | `components/conversation-list-item.tsx` | Inbox row — avatar, name, last message preview, time, unread badge |
| MessageBubble | `components/message-bubble.tsx` | Chat bubble — own (blue, right) vs theirs (muted, left), timestamps, read receipts (✓/✓✓), link detection |
| MessageInput | `components/message-input.tsx` | Auto-growing textarea + send button (ArrowUp icon), 2000 char limit with counter, Enter to send |
| AppSidebar | `components/app-sidebar.tsx` | Instagram-style nav, profile link with avatar, More menu |
| SidebarMoreMenu | `components/sidebar-more-menu.tsx` | Popover with theme toggle, language sub-view, logout |
| LoginFormContent | `components/login-form.tsx` | Reusable login form (email or username + forgot password link) |
| LoginDialog | `components/login-dialog.tsx` | Modal wrapper around LoginFormContent |
| RegisterFormContent | `components/register-form.tsx` | Register form with UsernameChecklist + PasswordChecklist |
| EmailConfirmationPrompt | `components/email-confirmation-prompt.tsx` | "Check email" screen with rate-limited resend + cooldown timer |
| EmailManagement | `components/email-management.tsx` | Profile email section: display, verified/notVerified state, resend (in edit mode). Change-email is delegated to ChangeEmailDialog. Cooldown timer lives here so it persists across dialog open/close. |
| ChangeEmailDialog | `components/change-email-dialog.tsx` | Modal form for changing email — new email + current password, rate-limit aware. Built on shadcn Dialog (focus trap, aria-modal, Escape). |
| PhoneManagement | `components/phone-management.tsx` | Profile phone section: display, verified/notVerified state. Change-phone is delegated to ChangePhoneDialog. |
| ChangePhoneDialog | `components/change-phone-dialog.tsx` | Modal form for adding/changing phone — new phone + current password. Built on shadcn Dialog. |
| PasswordChecklist | `components/password-checklist.tsx` | Live validation: length >= 8, uppercase, digit |
| UsernameChecklist | `components/username-checklist.tsx` | Live validation: format + debounced API availability check |
| LocationSearch | `components/location-search.tsx` | Nominatim city autocomplete with debounced search (used in profile + item form) |
| ThemeProvider | `components/theme-provider.tsx` | next-themes wrapper |
| ProfileCard | `components/profile-card.tsx` | Shared profile card for own/edit/public views. Inline edit mode with sticky Save/Cancel footer, hoisted profile-visibility master switch. WhatsApp is a sub-toggle of Show Phone (indented, auto-cleared when phone toggled off). Telegram input inline with toggle. Contact channels always editable (private profiles still visible to logged-in users). Uses helpers from `lib/profile-utils.ts`. |
| ProfilePopup | `components/profile-popup.tsx` | Profile preview overlay — bottom sheet (mobile) / centered modal (desktop). Built on shadcn Dialog (focus trap, aria-modal, Escape, scroll lock all from Radix/base-ui). |
| UserAvatar | `components/user-avatar.tsx` | Avatar with letter fallback + deterministic color (xs/sm/md/lg sizes) |
| AvatarUpload | `components/avatar-upload.tsx` | File picker + Cloudinary upload (updates auth context) |
| BadgeDisplay | `components/badge-display.tsx` | Renders up to 3 badge chips |
| ItemForm | `components/item-form.tsx` | Unified add+edit item form (3 tabs: Details, Pricing, Terms). Modal for edit, embedded in wizard for add. Uses ImageManager, LocationSearch, DateTimePicker. 3-layer help system: inline hints, HelpPopovers on complex fields, dismissible TipsBanners per tab. Includes countdown delete confirmation dialog. |
| ImageManager | `components/image-manager.tsx` | Shared image add/delete/reorder — arrow-based (mobile-friendly), no dnd-kit. Used by both add wizard and edit modal. Exports `FormImage` type. |
| ImageLightbox | `components/image-lightbox.tsx` | Fullscreen image preview overlay — arrow keys, escape, prev/next, counter. Reusable (used by ImageGallery + stall item cards). |
| ImageGallery | `components/image-gallery.tsx` | Item detail page image gallery with thumbnails, uses ImageLightbox. |
| ConfirmDialog | `components/confirm-dialog.tsx` | Generic confirmation dialog (title, message, confirm/cancel). |
| ItemCardShared | `components/item-card-shared.tsx` | Shared helpers: PriceDisplay, EndDateCountdown, timeAgo, isEnded. Field-based indicators (no TypeTag). |
| ItemDetailModal | `components/item-detail-modal.tsx` | Quick-view modal for item details from seller's stall page. |
| OffersPopup | `components/offers-popup.tsx` | Ticker v2 buyer popup + shared Dialog shell. base-ui Dialog (focus trap, ESC, focus return). Bottom sheet mobile / centered modal desktop. Branches on `data.isOwner` — buyer gets Ticker view, seller gets SellerView. Buyer components: TickerHeader (live dot, clickable title → item page, refresh, close), TickerHero (rolling digits, emerald flash, delta badge), TickerYourBid, TickerTimeStrip, TickerBidForm (stepper + optional segmented switch for Buy Now when instantBuyPrice exists), TickerExpandedBids (active + instant buy pills + denied bids). Instant buy: segmented "Place offer / ⚡ Buy now" tabs, 2-tap confirm, disabled when pending IB exists, buyer's form hidden when own IB pending. |
| SellerView | `components/seller-offers-popup.tsx` | Seller popup view. Live state: SellerSummaryLine + expandable BidderCards (Sell/Message/Deny buttons, 2-tap sell confirm, clickable avatar/name → profile) + close auction footer. Sold state: SoldHero + BUYER/RUNNERS-UP card grouping + winner card expandable (Message/Deny). Instant buy: SellerInstantBuyCard (accept/decline). |
| SellerInstantBuyCard | `components/instant-buy/seller-instant-buy-card.tsx` | Seller accept/decline card for pending instant buy. Emerald gradient border, buyer avatar + name (clickable), amount, Accept/Decline buttons with loading states. |
| SoldHero | `components/sold-state/sold-hero.tsx` | Diagonal SOLD stamp (rotated 8deg, anchored top-right) + emerald price + clickable winner name. Replaces SellerSummaryLine when sold. |
| OffersPage | `app/items/[id]/offers/page.tsx` | Full-page offers view — renders OffersPopup as Dialog overlay. Tab title blink hook (useTabBlink). Fetches item detail for title/image. Close navigates back to item page. |
| useRealtime | `hooks/use-realtime.ts` | Merged SignalR hook — single connection to `/hubs/app`, listens for `UnreadCountChanged` + `NotificationCountChanged`. Returns `{ messageCount, notificationCount, setNotificationCount, refetch }`. Polling fallback (30s) if SignalR fails. Replaces deleted `use-unread-count.ts`. |
| useOffersBids | `hooks/use-offers-bids.ts` | Core bidding hook: polling (10s/3s retry), Web Audio API sound (bid-ding.wav), slide-in animations, reliability tracking (stale/connection lost), manual refresh with spin state, sound toggle with localStorage, paginated expand (loadMore in batches of 5, collapseAll resets), onNewExternalBid callback for delta badge. Fixed: visibilitychange listener leak. |
| DateTimePicker | `components/datetime-picker.tsx` | Combined date + time picker for end dates. Uses shadcn Calendar + time inputs. |
| HelpPopover | `components/help-popover.tsx` | Reusable `(?)` icon → click-triggered Popover with title, description, optional good/bad examples. Uses `help` i18n namespace. |
| TipsBanner | `components/tips-banner.tsx` | Dismissible amber-tinted tips card with Lightbulb icon + bullet list. Per-tab content from `tips` i18n namespace. |
| useTipsDismissed | `lib/use-tips-dismissed.ts` | Cookie-based hook for tip banner dismissal. Cookie `manvaig_tips_dismissed`, 365-day expiry. |
| PublicItemCard | `components/public-item-card.tsx` | Public marketplace item card — image carousel, price/end-date pills, location, time-ago, bid count. Used by homepage feed and /search results. |
| PublicStallCard | `components/public-stall-card.tsx` | Public stall card — header strip (header image OR accent gradient with `bg-black/30` scrim for contrast), avatar/thumbnail circle, name (truncate), owner row with avatar + display name + location, item-count badge, preview thumbnails strip (cap 3 on `< sm:`, 4 from `sm:` upward). Click links to `/user/{displayName}`. Exports `PublicStallCardSkeleton` sibling. Shares visual primitives with PublicItemCard (rounded-xl, border, shadow). |
| useDebouncedValue | `lib/use-debounced-value.ts` | Generic `useDebouncedValue<T>(value, delayMs)` hook. setTimeout/clearTimeout in `useEffect`. Used by /search input. |
| VisibilityRadioCards | `components/visibility-radio-cards.tsx` | Shared 4-state vertical radio card control (Public / RegisteredOnly / LinkOnly / Private) used by BOTH `StallFormDialog` and `ItemForm`. Props: `value`, `onChange`, `mode: "stall" \| "item"` (selects helper-text variant), `name`, `disabled`. Vertical layout chosen over horizontal segmented to fit LV labels at 375px. `role="radiogroup"`, each card `role="radio"` + `aria-checked`, ≥44px tap target. Lucide icons: Globe / Users / Link / Lock. i18n source: shared `visibility.*` namespace with `.label`, `.helperStall`, `.helperItem` per state. |
| StallFormDialog | `components/stall-form-dialog.tsx` | Popup Dialog (`@base-ui/react`) replacing the inline add/edit stall forms. `mode: "add" \| "edit"`. Sections: Identity (Name 3-50 / Description ≤500 / read-only Slug-as-plain-text on edit), Visibility (`<VisibilityRadioCards mode="stall" />`), Defaults (collapsible with ICU-plural "{N} defaults set" badge; sub-groups Content [category, location, tags] + Commerce [condition, ships, accept-offers]). Sticky footer: Cancel + Save (edit-only Delete with countdown-confirm). Validate-on-blur. Server `IS_DEFAULT_REQUIRES_PUBLIC` → form-level banner; `nameTaken` → inline. a11y baked: form errors `aria-live="polite"`, field errors `aria-describedby`, collapsible `aria-expanded`+`aria-controls`. Image management (thumbnail/header/background/accent) lives OUT of this dialog — separate Appearance panel on detail page. |
| useRelativeTime | `lib/use-relative-time.ts` | Hook returning a formatter `(date) => string` that wraps `next-intl`'s `useFormatter().relativeTime(date, now)` and prefixes via `t("activeAgo", { time })`. Returns `t("activeNever")` for null/undefined. Used by `PublicUserCard` for the "Active N ago" label sourced from `LastSeenAt`. |
| PublicUserCard | `components/public-user-card.tsx` | Public user directory card on `/people`. Avatar + displayName, "Member since {year}", "Active N ago" via `useRelativeTime`, contact-method icons (WhatsApp/Telegram/Phone/Email) driven by `Has*` booleans from `PublicUserCardDto`. Click → `/user/{displayName}`. Skeleton variant exported alongside. |

### shadcn/ui Components Installed

button, input, label, separator, skeleton, tooltip, sheet, sidebar, popover, dialog, avatar, badge, switch, textarea, card, calendar

---

## Deployment (Railway)

### Docker Setup

Both services use multi-stage Dockerfiles for small production images.

**Backend (`backend/Dockerfile`):**
- Build stage: `dotnet/sdk:9.0` → restore, publish Release
- Runtime stage: `dotnet/aspnet:9.0` → runs `ManVaig.Api.dll`
- Listens on `PORT` env var (Railway sets this), defaults to 8080

**Frontend (`frontend/Dockerfile`):**
- Deps stage: `node:22-alpine` → `npm ci`
- Build stage: builds Next.js with `NEXT_PUBLIC_API_URL` build arg
- Runtime stage: runs standalone `server.js` as non-root user
- Requires `output: "standalone"` in `next.config.ts`

### Railway Environment Variables (Backend)

| Variable | Example | Notes |
|----------|---------|-------|
| `ConnectionStrings__DefaultConnection` | `Host=...;Database=...` | Railway provides PostgreSQL, use internal URL |
| `Jwt__Secret` | (generate 64+ char random string) | Must differ from dev |
| `Jwt__Issuer` | `ManVaig.Api` | |
| `Jwt__Audience` | `ManVaig.Frontend` | |
| `Jwt__ExpirationDays` | `7` | |
| `Cors__AllowedOrigins__0` | `https://your-frontend.up.railway.app` | Frontend URL |
| `Resend__ApiKey` | (from Resend dashboard) | Optional for first deploy |
| `Resend__FromEmail` | `ManVaig <noreply@manvaig.com>` | Needs custom domain later |
| `Cloudinary__CloudName` | | Optional |
| `Cloudinary__ApiKey` | | Optional |
| `Cloudinary__ApiSecret` | | Optional |

### Railway Environment Variables (Frontend)

| Variable | Example | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.up.railway.app` | Set as build arg in Railway |

### Config Override Pattern

.NET reads env vars with `__` as section separator. E.g., `Jwt__Secret` overrides `appsettings.json → Jwt.Secret`. No production config files needed — all secrets via Railway env vars.

---

---

## Prototypes

### Items Management (`docs/prototypes/items-management.html`)

Interactive HTML prototype for the seller's "My Items" page. Serves as the design spec for Phase 4 implementation.

**List View (card-based, marketplace style):**
- Card layout: large image → title → price (emerald `#34d399`) → separator → footer (views/bids/age + edit button)
- Type tag: top-left corner overlay (Fixed=blue, Offers=purple, Bidding=orange, Auction=orange)
- Visibility tag: top-right corner overlay (Private=gray, Registered=amber, Link Only=teal, Public=no tag)
- Dimmed cards for ended auctions
- No delete button in list (only in edit form)
- No view/preview button (edit only; preview-as-buyer deferred)
- Empty state with box icon + "Add your first item" CTA

**Add/Edit Form (slide-in panel):**
- Images: up to 5, drag-to-reorder, star marks primary, delete per image
- Basic Info: Title*, Description, Category* (12 broad categories dropdown), Location (Nominatim autocomplete), Condition (New/LikeNew/Good/Fair/Poor segmented)
- Composable Pricing: Price field (optional) + Accept Offers toggle + End Date toggle
  - Progressive disclosure: sub-fields appear when toggles are ON
- Tags: free-form tag input (max 10)
- Visibility & Options: Public/Registered/Link Only/Private dropdown, guest offers toggle, can-ship toggle
- Delete button: only in Edit mode, bottom of form

**Design Decisions (from this session):**
- **No sold history**: when item is sold, seller removes it or marks unavailable
- **Item status**: Available only (no "Under Offer" state). Buyers make offers freely → seller contacts preferred buyer → removes item
- **Location**: OpenStreetMap Nominatim autocomplete (free, global, no API key). Debounced 300ms. Stores city + country. Falls back to plain text if API down. Pre-filled from seller's profile.
- **Categories**: 12 broad categories (Electronics, Clothing & Accessories, Vehicles & Parts, Home & Garden, Sports & Outdoors, Antiques & Collectibles, Books & Media, Musical Instruments, Toys & Hobbies, Health & Beauty, Building Materials, Other). Tags handle detailed classification.
- **Pricing colors**: all prices use emerald `#34d399` regardless of type. Auction countdown: white normally, red only when ending soon.
- **Auction/Bidding colors**: both use orange `#f97316`

---

## Phase 4 Implementation Plan

Build order for items management (from prototype → actual environment):

| Step | What | Status |
|------|------|--------|
| 0 | Update PROJECT_SPEC.md — align models with prototype | done |
| 1 | Backend: models + migration + seed 12 categories | done |
| 2 | Backend: Items CRUD API + tag autocomplete + categories list | done |
| 3 | Frontend: My Items list page + sidebar nav | done |
| 4 | Frontend: Add/Edit item form (image slots visual-only, no upload) + full i18n | done |
| 5 | Discuss: validation rules, error/loading states | done (agreed 2026-03-28) |
| 5b | Implement validation + error/loading states | done |
| 6 | Item image upload (Cloudinary, max 5, drag-to-reorder) | done |
| 7 | Auction bidders list — prototype first, then implement | done |
| 8 | Public item detail page | done |
| 9 | Item ordering (SortOrder + sort param + reorder endpoint) | done |
| 10 | Activity badges (bid count, highest bid, ended/ending soon) | done |
| 11 | 3-step add item wizard (dedicated page) | done |
| 12 | Shared ImageManager (arrow reorder, mobile-friendly) | done |

**Key model decisions (from plan audit):**
- Item → UserId (not ShopId) — no Shop dependency in v1, migrate in Phase 3
- Category: flat (Id, Name, SortOrder) — no tree hierarchy
- Composable pricing: AcceptOffers + Price + MinOfferPrice + OfferStep + EndDate (replaced PricingType enum)
- Condition: 5-value enum (New, LikeNew, Good, Fair, Poor) — replaced 3-value (New, Used, Worn)
- No Status enum — seller removes item, ended items derived from EndDate < now
- MaxItems on User (default 10) — manually set in DB, purchasable in future
- Location: Nominatim autocomplete, stores "City, Country" string

**Validation rules (updated 2026-05-07 — composable pricing):**

Common:
- Title — required, 3–100 chars
- Category — required
- Condition — required (New / LikeNew / Good / Fair / Poor)
- Images — at least 1 required
- Description — optional, max 2000 chars
- Location — optional, max 200 chars
- Tags — max 10, each max 30 chars

Composable pricing rules:
- Must have price OR acceptOffers enabled (error: `NO_BUYER_ACTION`)
- Price > 0 when set (error: `PRICE_POSITIVE`)
- MinOfferPrice/OfferStep silently cleared when acceptOffers=false
- EndDate requires acceptOffers=true (error: `ENDDATE_REQUIRES_OFFERS`)
- EndDate must be ≥ 1h in future (error: `ENDDATE_TOO_SOON`)
- MinOfferPrice ≤ Price when both set (error: `MIN_OFFER_EXCEEDS_PRICE`)
- MinOfferPrice ≥ 0, OfferStep > 0 when set

**Offer lock lifecycle (timed items):**

| State | Condition | Seller can do |
|-------|-----------|--------------|
| Draft | 0 offers | Edit everything, delete freely |
| Active (locked) | EndDate set + AcceptOffers + 1+ active offers | Nothing — fully readonly |
| Ended (grace) | EndDate passed, < 48h | Readonly, cannot delete. Winner visible. |
| Settled | Grace period (48h) expired | Can delete/archive |

- Non-timed offer items are NOT locked (seller retains control until manual accept)
- 0 offers at end → no grace period, seller can edit/delete immediately
- Anti-snipe: only applies when EndDate is set
- Enforced both frontend (show/hide fields, i18n errors) and backend (same rules + 403 on locked item edit/delete)


## Phase Completion

- **Phase 1** (Scaffolding): 6/7 done — Railway deploy working (backend + frontend + PostgreSQL)
- **Phase 2** (Auth): mostly complete — forgot/reset password, unique usernames, login by username, change email with rate limiting, bilingual emails, password/username checklists. Remaining: phone verification, OAuth
- **Phase 3** (Stalls): mostly done — stall CRUD, background images, stall items page with activity badges, attention filter, drag-and-drop reorder. Remaining: public stall page, contact details
- **Phase 4** (Items): nearly complete — composable pricing (replaced PricingType enum), 5-condition enum, unified item form (3 tabs, add+edit), 2-step add wizard, countdown delete dialog, field-based card indicators. Remaining: public item detail SSR improvements
- **Phase 5** (Bidding): Complete — offers popup (bottom sheet/modal), real-time polling with sound, anti-snipe, full offers page, two-tap confirm. **Instant Buy**: segmented switch (Place offer / Buy now), 2-tap confirm, seller accept/decline card, Buy Now disabled when pending. **Sold state**: SoldHero (SOLD stamp + emerald price + winner), manage actions (cancel deal for non-timed, pass-to-next + close auction for ended timed). **Bid deny**: seller can deny bidders with reasons. **Notifications**: 12 event types including InstantBuy + AuctionReopened/Closed. Item subscriptions with bell toggle + auto-subscribe on bid.
- **Phase 7** (Browse): Homepage feed with category chips + infinite scroll, public item detail page, **unified `/search` page** with Items|Stalls tabs and `?q=` text search (server-side ILIKE on title + description + tag name + stall name + owner display name, Postgres `unaccent` extension for diacritic folding so `riga` matches `Rīga`), debounced 300ms input with min 2 chars, hint chips, Load more pagination. Lighthouse mobile a11y/best-practices/agentic 100/100/100. Remaining: standalone browse-all-items page, category/tag filters as facets, public stall detail page (`/search` stall card currently links to `/user/{displayName}` profile)
- **Phase 8** (Polish): Instagram-style sidebar redesign, More menu, avatar in sidebar, collapse state persistence
- **Phase 6** (Notifications): In-app notifications done — Notification model (7 event types: NewBid, AuctionEnded, BidAccepted, NewItemFromFollowed, BidDenied, ItemDeleted, BidWon), NotificationService with follower throttling + subscriber fan-out, AuctionEndedService (60s polling), NotificationCleanupService (90-day retention), AppHub (consolidated from ChatHub), bell icon + dropdown + full page with load-more pagination, ItemSubscription model for opt-in/out. Remaining: email notification on new offer (Resend)

## What's Next

1. Complete Railway deployment configuration (env vars)
2. Phase 3: Public stall page, contact details
3. Phase 6: Email notification on new offer (Resend)
4. Phase 5 extras: "My Bids" page, bid cancellation (2-min grace period)
5. Phase 7: Standalone browse-all-items page (no query required), category/tag filter facets on `/search`, public stall detail page (currently `/search` stall card links to `/user/{displayName}`)

## Known Issues

- Console warnings "Functions are not valid as React child" from sidebar Label components (low priority)
- `appsettings.json` has local DB password — needs env var for production
- Resend sender is `onboarding@resend.dev` (dev domain) — need custom domain for production (`noreply@manvaig.com`)
- Cloudinary credentials empty in `appsettings.json` — avatar upload won't work until configured in `appsettings.Development.json`
- Phone verification is stubbed (always shows "unverified") — needs implementation later
- Communication channels: ShowEmail/ShowPhone flags control visibility independently of verification status
