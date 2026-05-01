# ManVaig — Architecture Guide

> How the project works. Updated after every completed feature.
> Last updated: 2026-04-30 (session 7: auth improvements, email management, sidebar redesign)

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

DI registration order: EF Core → Identity → JWT → CORS → Resend → Cloudinary/ImageService → Controllers

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

Custom fields: `DisplayName` (unique username, 3-30 chars, `[a-zA-Z0-9_-]`), `AvatarUrl`, `Bio`, `Location`, `Phone`, `IsProfilePublic` (default true), `EnabledChannels` (flags enum: WhatsApp=1, Telegram=2), `IsActive` (bool), `CreatedAt`, `LastEmailSentAt` (nullable, for rate limiting)

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
| `GET users/{displayName}` | Public | Public profile (email/phone hidden). 404 if private/inactive/not found. Case-insensitive lookup. |

### Image Service: `Services/CloudinaryImageService.cs`

- Implements `IImageService.UploadAvatarAsync(stream, fileName, userId)`
- SixLabors.ImageSharp: resize to 256x256, center crop, encode as WebP (quality 80)
- Uploads to Cloudinary as `manvaig/avatars/{userId}`, returns secure URL
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
                      └─ SidebarInset > main > {children}
```

### i18n System

- Config: `src/i18n/config.ts` — `locales = ["en", "lv"]`, `defaultLocale = "en"`
- Request: `src/i18n/request.ts` — reads `NEXT_LOCALE` cookie, imports `messages/{locale}.json`
- Switching: `LanguageSwitcher` sets cookie + `router.refresh()` (full page re-render, no URL prefix)
- Translation files: `messages/en.json`, `messages/lv.json`
- Namespaces: `nav`, `home`, `language`, `theme`, `login`, `register`, `emailConfirmation`, `emailManagement`, `passwordChecklist`, `usernameChecklist`, `forgotPassword`, `resetPassword`, `profile`, `items`, `itemForm`, `feed`, `itemDetail`
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
- `getPublicProfile(displayName)` → `UserProfile` (anonymous)
- `authFetch(url, options)` → `Response` (auto-attaches Bearer, auto-logout on 401)

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
- Footer: Profile link with `UserAvatar` (xs size) + `SidebarMoreMenu` popover
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
| `/items/[id]` | `app/items/[id]/page.tsx` | Public item detail page |

### Component Map

| Component | File | Purpose |
|-----------|------|---------|
| AppLayout | `components/app-layout.tsx` | SidebarProvider + SidebarInset wrapper |
| AppSidebar | `components/app-sidebar.tsx` | Instagram-style nav, profile link with avatar, More menu |
| SidebarMoreMenu | `components/sidebar-more-menu.tsx` | Popover with theme toggle, language sub-view, logout |
| LoginFormContent | `components/login-form.tsx` | Reusable login form (email or username + forgot password link) |
| LoginDialog | `components/login-dialog.tsx` | Modal wrapper around LoginFormContent |
| RegisterFormContent | `components/register-form.tsx` | Register form with UsernameChecklist + PasswordChecklist |
| EmailConfirmationPrompt | `components/email-confirmation-prompt.tsx` | "Check email" screen with rate-limited resend + cooldown timer |
| EmailManagement | `components/email-management.tsx` | Profile email section: display, change (with password), resend, cooldown |
| PasswordChecklist | `components/password-checklist.tsx` | Live validation: length >= 8, uppercase, digit |
| UsernameChecklist | `components/username-checklist.tsx` | Live validation: format + debounced API availability check |
| LocationSearch | `components/location-search.tsx` | Nominatim city autocomplete with debounced search (used in profile + item form) |
| ThemeProvider | `components/theme-provider.tsx` | next-themes wrapper |
| ProfileCard | `components/profile-card.tsx` | ID card layout with inline edit mode + EmailManagement |
| UserAvatar | `components/user-avatar.tsx` | Avatar with letter fallback + deterministic color (xs/sm/md/lg sizes) |
| AvatarUpload | `components/avatar-upload.tsx` | File picker + Cloudinary upload (updates auth context) |
| BadgeDisplay | `components/badge-display.tsx` | Renders up to 3 badge chips |
| ItemForm | `components/item-form.tsx` | Add/Edit item modal (uses LocationSearch for autocomplete) |

### shadcn/ui Components Installed

button, input, label, separator, skeleton, tooltip, sheet, sidebar, popover, dialog, avatar, badge, switch, textarea, card

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
- Basic Info: Title*, Description, Category* (12 broad categories dropdown), Location (Nominatim autocomplete), Condition (New/Used/Worn segmented)
- Pricing Type: 4 cards — Fixed Price, Fixed + Offers, Open Bidding, Auction
  - Each type shows relevant fields (price, min bid, step, auction end date)
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
| 7 | Auction bidders list — prototype first, then implement | next up |
| 8 | Public item detail page | deferred |

**Key model decisions (from plan audit):**
- Item → UserId (not ShopId) — no Shop dependency in v1, migrate in Phase 3
- Category: flat (Id, Name, SortOrder) — no tree hierarchy
- PricingType enum: Fixed / FixedOffers / Bidding / Auction
- No Status enum — seller removes item, ended auctions derived from AuctionEnd < now
- MaxItems on User (default 10) — manually set in DB, purchasable in future
- Location: Nominatim autocomplete, stores "City, Country" string

**Validation rules (agreed 2026-03-28):**

Common (all pricing types):
- Title — required, 3–100 chars
- Category — required
- Condition — required (New / Used / Worn)
- Images — at least 1 required (enforce in Step 6 when upload lands)
- Description — optional, max 2000 chars
- Location — optional, max 200 chars
- Tags — max 10, each max 30 chars

Per pricing type:
- **Fixed Price** — Price required, > 0, max 2 decimals
- **Fixed + Offers** — Price required, > 0; MinOfferPrice optional (> 0, <= Price)
- **Open Bidding** — no price required; MinBidPrice optional > 0; BidStep optional > 0
- **Auction** — StartingPrice required > 0; AuctionEnd required (min 1h in future); BidStep optional > 0

**Auction lifecycle:**

| State | Condition | Seller can do |
|-------|-----------|--------------|
| Draft | 0 bids | Edit everything, delete freely |
| Active (locked) | 1+ bids | Nothing — fully readonly |
| Ended (grace) | AuctionEnd passed, < 48h | Readonly, cannot delete. Winner visible. |
| Settled | Grace period (48h) expired | Can delete/archive |

- 0 bids at end → no grace period, seller can edit/delete immediately
- No reserve price in v1 — starting price is effectively the reserve
- Enforced both frontend (show/hide fields, i18n errors) and backend (same rules + 403 on locked auction edit/delete)


## Phase Completion

- **Phase 1** (Scaffolding): 6/7 done — Railway deploy working (backend + frontend + PostgreSQL)
- **Phase 2** (Auth): mostly complete — forgot/reset password, unique usernames, login by username, change email with rate limiting, bilingual emails, password/username checklists. Remaining: phone verification, OAuth
- **Phase 4** (Items): Steps 0–6 done — prototype, models, API, My Items page, Add/Edit form, validation, image upload
- **Phase 5** (Bidding): Auction bidding system implemented (Bid model, endpoints, bid history UI)
- **Phase 7** (Browse): Homepage feed with category chips, infinite scroll, public item detail page
- **Phase 8** (Polish): Instagram-style sidebar redesign, More menu, avatar in sidebar, collapse state persistence
- **Phase 3, 6**: Not started

## What's Next

1. Complete Railway deployment configuration (env vars)
2. Phase 3: Shop management
3. Phase 5: Offer system (non-auction offers)
4. Phase 6: Notifications

## Known Issues

- Console warnings "Functions are not valid as React child" from sidebar Label components (low priority)
- `appsettings.json` has local DB password — needs env var for production
- Resend sender is `onboarding@resend.dev` (dev domain) — need custom domain for production (`noreply@manvaig.com`)
- Cloudinary credentials empty in `appsettings.json` — avatar upload won't work until configured in `appsettings.Development.json`
- Phone verification is stubbed (always shows "unverified") — needs implementation later
- Communication channels (WhatsApp/Telegram) hidden from public profiles until phone is verified
