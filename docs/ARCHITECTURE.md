# ManVaig — Architecture Guide

> How the project works. Updated after every completed feature.
> Last updated: 2026-03-20

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

DI registration order: EF Core → Identity → JWT → CORS → Resend → Controllers

- `AppDbContext` — Npgsql, connection string from `ConnectionStrings:DefaultConnection`
- Identity config: `RequireDigit=true, RequiredLength=8, RequireNonAlphanumeric=false, RequireUniqueEmail=true`
- JWT: reads `Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpirationDays` from config
- Resend: `ResendClient` via HttpClient, API key from `Resend:ApiKey`
- DI: `IEmailService → ResendEmailService` (transient)

### Database: `Data/AppDbContext.cs`

- Extends `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>`
- Custom entity config: field length constraints on ApplicationUser
- All Identity tables (AspNetUsers, AspNetRoles, etc.) managed by Identity

### Model: `Models/ApplicationUser.cs`

Extends `IdentityUser<Guid>` — inherits `Id`, `Email`, `UserName`, `EmailConfirmed`, `PasswordHash`, etc.

Custom fields: `DisplayName`, `AvatarUrl`, `Bio`, `Location`, `IsActive` (bool), `CreatedAt`

### DTOs: `Models/Dto/AuthDtos.cs`

- `RegisterRequest` — Email, Password, DisplayName
- `LoginRequest` — Email, Password
- `AuthResponse` — Token, ExpiresAt, UserId, Email, DisplayName, EmailConfirmed
- `ConfirmEmailRequest` — UserId, Token

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

### Email Service: `Services/ResendEmailService.cs`

- Implements `IEmailService.SendEmailConfirmationAsync(email, confirmationLink)`
- Sends styled HTML email with confirmation button
- Catches exceptions silently (registration succeeds even if email fails)
- `FromEmail` from `Resend:FromEmail` config

### Config Files

- `appsettings.json` — tracked in git, has empty `Resend:ApiKey`, local DB connection string
- `appsettings.Development.json` — gitignored, has real Resend API key
- Production will need env vars for: DB connection, JWT secret, Resend API key

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
- Namespaces: `nav`, `home`, `language`, `theme`, `login`, `register`, `emailConfirmation`
- Rich text pattern: `t.rich("key", { tag: (chunks) => <Link>{chunks}</Link> })`

### Auth System

**`lib/auth.ts`** — API functions:
- `login(email, password)` → `AuthResponse`
- `register(email, password, displayName)` → `AuthResponse`
- `confirmEmail(userId, token)` → `{ message }`
- `resendConfirmation()` → `{ message }` (sends Bearer token)
- `saveToken(token)` / `getToken()` / `logout()` — localStorage (`manvaig_token`)

**`lib/auth-context.tsx`** — React context:
- On mount: reads token from localStorage, parses JWT via `atob(token.split(".")[1])`
- Extracts: `sub`→userId, `email`, `displayName`, `emailConfirmed` (string→boolean)
- `useAuth()` exposes: `isLoggedIn`, `user` (with `emailConfirmed`), `openLoginDialog`, `setUser`, `logout`
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

### shadcn/ui Components Installed

button, input, label, separator, skeleton, tooltip, sheet, sidebar, popover, dialog

---

## Phase Completion

- **Phase 1** (Scaffolding): 6/7 done — Railway deploy pending
- **Phase 2** (Auth): 7/11 done — profile page planned; forgot-password, OAuth, show/hide future
- **Phase 3–8**: Not started

## What's Next

1. User profile page (view + edit) — Phase 2
2. Phase 3: Shop management (model, CRUD, dashboard, contact details)
3. Phase 4: Item listings

## Known Issues

- Console warnings "Functions are not valid as React child" from sidebar Label components (low priority)
- `appsettings.json` has local DB password — needs env var for production
- Resend sender is `onboarding@resend.dev` (dev domain) — need custom domain for production
