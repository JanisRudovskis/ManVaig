# ManVaig — Claude Instructions

## Rules (in priority order)

1. **No code or commits without approval.** Never edit code files or make git commits unless the user explicitly asks. Describe proposed changes first, wait for approval. Wait for "commit" before running git add/commit.
2. **Plan first, code after approval.** Always discuss the approach before writing any code. Only start implementation after explicit user approval.
3. **Think small, extend later.** Build the simplest working version first. Push back if a feature seems unnecessary for v1.
4. **Design UI pages separately.** Every frontend page gets its own design discussion before coding.
5. **No browser-native validation.** All form validation must use custom i18n-aware messages, never `required`/`minLength`/`type="email"` HTML attributes.
6. **Update docs after every completed step.** This is automatic — never wait to be asked. After finishing any task:
   - `docs/ROADMAP.html` — change task `data-status` to `done`, update badge, update "last updated" date, add session comment
   - `docs/tests/*.md` — add/update test cases for the feature
   - `docs/PROJECT_SPEC.md` — update if the feature changes spec decisions or adds new models/endpoints
   - `docs/ARCHITECTURE.md` — update architecture notes, component list, what's built, what's next
   - Commit documentation updates WITH the code changes (same commit)
   - Never consider a task "done" until all docs are updated.

## Session Start
On first message of a new conversation, read these to understand current state:
1. `docs/ARCHITECTURE.md` — how the project works, what's built
2. `docs/ROADMAP.html` — what's done, what's next

## Key Documentation Files
- **`docs/ROADMAP.html`** — interactive progress tracker, source of truth for what's done and what's next
- **`docs/PROJECT_SPEC.md`** — feature spec, data models, architectural decisions
- **`docs/ARCHITECTURE.md`** — how the project works: provider tree, data flow, component relationships, patterns
- **`docs/tests/*.md`** — manual test checklists per feature area

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
