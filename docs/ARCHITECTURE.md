# ManVaig — Architecture Guide

> How the project works. Updated after every completed feature.
> Last updated: 2026-03-21 (session 3: Railway deployment setup — Dockerfiles, standalone output, env var docs)

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

Custom fields: `DisplayName` (unique), `AvatarUrl`, `Bio`, `Location`, `Phone`, `IsProfilePublic` (default true), `EnabledChannels` (flags enum: WhatsApp=1, Telegram=2), `IsActive` (bool), `CreatedAt`

Navigation properties: `UserBadges`, `DisplayedBadges`

### Badge System

Three tables:
- `BadgeDefinition` — catalog (Id, Key unique, Name, Description, IconUrl). Seeded with "top_1000".
- `UserBadge` — which badges a user has earned (composite key: UserId+BadgeDefinitionId)
- `UserDisplayedBadge` — which 3 badges the user chose to show (composite key + SortOrder 0-2)

### DTOs: `Models/Dto/AuthDtos.cs`

- `RegisterRequest` — Email, Password, DisplayName
- `LoginRequest` — Email, Password
- `AuthResponse` — Token, ExpiresAt, UserId, Email, DisplayName, EmailConfirmed
- `ConfirmEmailRequest` — UserId, Token

### DTOs: `Models/Dto/ProfileDtos.cs`

- `UserProfileResponse` — all profile fields + displayed badges (email/phone nulled for public view)
- `UpdateProfileRequest` — partial update: bio, location, phone, isProfilePublic, enabledChannels, displayedBadgeIds (max 3)
- `BadgeDto` — id, key, name, iconUrl

### Controller: `Controllers/V1/AuthController.cs`

All routes under `/api/v1/auth/`:

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `POST register` | Public | Creates user, sends confirmation email via Resend, returns JWT with `emailConfirmed: false` |
| `POST login` | Public | Validates credentials, checks `IsActive`, returns JWT |
| `POST confirm-email` | Public | Accepts `{userId, token}`, calls `ConfirmEmailAsync` |
| `POST resend-confirmation` | Bearer | Reads userId from JWT, sends new confirmation email |

### JWT Claims

Token contains: `sub` (userId), `email`, `jti`, `displayName`, `emailConfirmed` (string `"true"`/`"false"`)

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

- Implements `IEmailService.SendEmailConfirmationAsync(email, confirmationLink)`
- Sends styled HTML email with confirmation button
- Catches exceptions silently (registration succeeds even if email fails)
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
- Namespaces: `nav`, `home`, `language`, `theme`, `login`, `register`, `emailConfirmation`, `profile`
- Rich text pattern: `t.rich("key", { tag: (chunks) => <Link>{chunks}</Link> })`

### Auth System

**`lib/auth.ts`** — API functions:
- `login(email, password)` → `AuthResponse`
- `register(email, password, displayName)` → `AuthResponse`
- `confirmEmail(userId, token)` → `{ message }`
- `resendConfirmation()` → `{ message }` (sends Bearer token)
- `saveToken(token)` / `getToken()` / `logout()` — localStorage (`manvaig_token`)
- `getMyProfile()` → `UserProfile` (authorized)
- `updateProfile(data)` → `UserProfile` (authorized, partial update)
- `uploadAvatar(file)` → `{ avatarUrl }` (authorized, FormData)
- `getPublicProfile(displayName)` → `UserProfile` (anonymous)

**`lib/auth-context.tsx`** — React context:
- On mount: reads token from localStorage, parses JWT via `atob(token.split(".")[1])`
- Extracts: `sub`→userId, `email`, `displayName`, `emailConfirmed` (string→boolean)
- `isLoading` state prevents race conditions — pages wait for auth to initialize before checking `isLoggedIn`
- `useAuth()` exposes: `isLoggedIn`, `isLoading`, `user` (with `emailConfirmed`), `openLoginDialog`, `setUser`, `logout`
- `LoginDialog` rendered inside `AuthProvider` — any component calls `openLoginDialog()` to trigger it

### Component Patterns

**Forms shared between page and dialog:**
- `LoginFormContent` — reusable form logic. Used by `LoginForm` (page at `/login`) and `LoginDialog` (modal).
- `RegisterFormContent` — reusable form. Used by `RegisterForm` (page at `/register`). After success, shows `EmailConfirmationPrompt` instead of redirecting.

**No browser-native validation:**
All `required`, `minLength`, `type="email"` removed. Custom `validate()` functions return i18n error strings. This ensures validation messages appear in the user's selected language.

**Sidebar:** `AppSidebar` uses shadcn `Sidebar` with `collapsible="icon"`. Nav items defined as array. Footer: ThemeToggle, LanguageSwitcher, AuthButton (login/logout).

### Pages (App Router)

| Route | Component | Type |
|-------|-----------|------|
| `/` | `app/page.tsx` | Server component |
| `/login` | `LoginForm` | Client component |
| `/register` | `RegisterForm` → `EmailConfirmationPrompt` | Client component |
| `/confirm-email?userId=...&token=...` | `app/confirm-email/page.tsx` | Client component |
| `/profile` | `ProfileCard` (inline edit) | Client component, auth required |
| `/user/[displayName]` | `ProfileCard` (read-only) | Client component, public |

### Component Map

| Component | File | Purpose |
|-----------|------|---------|
| AppLayout | `components/app-layout.tsx` | SidebarProvider + SidebarInset wrapper |
| AppSidebar | `components/app-sidebar.tsx` | Nav items, footer (theme/lang/auth) |
| LoginFormContent | `components/login-form.tsx` | Reusable login form (page + dialog) |
| LoginDialog | `components/login-dialog.tsx` | Modal wrapper around LoginFormContent |
| RegisterFormContent | `components/register-form.tsx` | Register form + post-registration check-email |
| EmailConfirmationPrompt | `components/email-confirmation-prompt.tsx` | "Check email" screen (page + inline variants) |
| LanguageSwitcher | `components/language-switcher.tsx` | Popover dropdown, sets NEXT_LOCALE cookie |
| ThemeToggle | `components/theme-toggle.tsx` | Sun/Moon toggle in sidebar |
| ThemeProvider | `components/theme-provider.tsx` | next-themes wrapper |
| ProfileCard | `components/profile-card.tsx` | ID card layout with inline edit mode |
| UserAvatar | `components/user-avatar.tsx` | Avatar with letter fallback + deterministic color |
| AvatarUpload | `components/avatar-upload.tsx` | File picker + Cloudinary upload |
| BadgeDisplay | `components/badge-display.tsx` | Renders up to 3 badge chips |

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

## Phase Completion

- **Phase 1** (Scaffolding): 6/7 done — Railway deploy in progress (Dockerfiles ready)
- **Phase 2** (Auth): 9/12 done — profile page done + polished; phone verification, forgot-password, OAuth, show/hide future
- **Phase 3–8**: Not started

## What's Next

1. Complete Railway deployment (create project, add services, configure env vars)
2. Phase 3: Shop management (model, CRUD, dashboard, contact details)
3. Phase 4: Item listings
4. Cloudinary configuration for avatar uploads

## Known Issues

- Console warnings "Functions are not valid as React child" from sidebar Label components (low priority)
- `appsettings.json` has local DB password — needs env var for production
- Resend sender is `onboarding@resend.dev` (dev domain) — need custom domain for production (`noreply@manvaig.com`)
- Cloudinary credentials empty in `appsettings.json` — avatar upload won't work until configured in `appsettings.Development.json`
- Phone verification is stubbed (always shows "unverified") — needs implementation later
- Communication channels (WhatsApp/Telegram) hidden from public profiles until phone is verified
