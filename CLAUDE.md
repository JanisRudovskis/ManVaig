# ManVaig — Claude Instructions

## Workflow Rules
- **Plan first, code after approval.** Always discuss the approach before writing any code. Only start implementation after explicit user approval.
- **Think small, extend later.** Build the simplest working version first. Push back if a feature seems unnecessary for v1.
- **Design UI pages separately.** Every frontend page gets its own design discussion before coding.
- **No browser-native validation.** All form validation must use custom i18n-aware messages, never `required`/`minLength`/`type="email"` HTML attributes.

## GROUND RULE: Update docs after EVERY completed step
This is automatic — never wait to be asked. After finishing any task:
1. `docs/ROADMAP.html` — change task `data-status` to `done`, update badge, update "last updated" date, add session comment
2. `docs/tests/*.md` — add/update test cases for the feature
3. `docs/PROJECT_SPEC.md` — update if the feature changes spec decisions or adds new models/endpoints
4. `docs/ARCHITECTURE.md` — update architecture notes, component list, what's built, what's next
5. Commit documentation updates WITH the code changes (same commit)
Never consider a task "done" until all docs are updated.

## Key Documentation Files
- **`docs/ROADMAP.html`** — interactive progress tracker, source of truth for what's done and what's next. Read at start of each conversation.
- **`docs/PROJECT_SPEC.md`** — feature spec, data models, architectural decisions. No progress tracking here.
- **`docs/ARCHITECTURE.md`** — how the project works: provider tree, data flow, component relationships, patterns.
- **`docs/tests/*.md`** — manual test checklists per feature area.

## Project Structure
```
ManVaig/
├── frontend/          Next.js 16 (TypeScript, Tailwind, shadcn/ui, App Router)
│   ├── src/
│   │   ├── app/           Pages (App Router)
│   │   ├── components/    React components + ui/ (shadcn)
│   │   ├── lib/           auth.ts, auth-context.tsx, utils.ts
│   │   └── i18n/          config.ts, request.ts
│   └── messages/          en.json, lv.json
├── backend/
│   ├── ManVaig.sln
│   └── ManVaig.Api/
│       ├── Controllers/V1/
│       ├── Models/ + Models/Dto/
│       ├── Data/
│       └── Services/
└── docs/
    ├── PROJECT_SPEC.md
    ├── ARCHITECTURE.md
    ├── ROADMAP.html
    └── tests/
```

## Conventions
- API routes: `/api/v1/...` — versioned from day one
- Auth: ASP.NET Identity + JWT (7-day token, no refresh in v1)
- Database: PostgreSQL + EF Core code-first, Guid primary keys
- Default currency: EUR
- Frontend: mobile-first, shadcn/ui components
- i18n: English + Latvian, cookie-based (`NEXT_LOCALE`), no URL prefixes
- Logging: Serilog → console (Railway logs in production)
- CORS: configurable via `appsettings.json` → `Cors:AllowedOrigins`
- Email: Resend (API key in appsettings.Development.json for dev, env var for prod)

## ROADMAP.html Format
Task statuses: `done`, `progress`, `planned`, `future`
Badge classes: `badge-done`, `badge-progress`, `badge-planned`, `badge-future`
Phases: 1 (Scaffolding) → 2 (Auth) → 3 (Shop) → 4 (Items) → 5 (Offers) → 6 (Notifications) → 7 (Browse) → 8 (Polish)
