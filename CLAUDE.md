# ManVaig — Claude Instructions

## Workflow Rules
- **Plan first, code after approval.** Always discuss the approach before writing any code. Only start implementation after explicit user approval.
- **Update docs after every completed task.** After finishing any task:
  1. Update `docs/ROADMAP.html` — change task `data-status` to `done`, update badge class/text, update the "last updated" date in the header.
  2. Commit documentation updates with the code changes.
- **ROADMAP.html is the source of truth** for what's done and what's next. Read it at the start of each conversation to understand current progress.
- **PROJECT_SPEC.md is the spec** — features, data models, architectural decisions. Don't add progress tracking there.

## Project Structure
```
ManVaig/
├── frontend/          Next.js 16 (TypeScript, Tailwind, shadcn/ui, App Router)
├── backend/
│   ├── ManVaig.sln
│   └── ManVaig.Api/   ASP.NET Core Web API (.NET 9)
│       ├── Controllers/V1/
│       ├── Models/
│       ├── Data/
│       └── Services/
└── docs/
    ├── PROJECT_SPEC.md
    └── ROADMAP.html
```

## Conventions
- API routes: `/api/v1/...` — versioned from day one
- Auth: ASP.NET Identity + JWT (7-day token, no refresh in v1)
- Database: PostgreSQL + EF Core code-first, Guid primary keys
- Default currency: EUR
- Frontend: mobile-first, shadcn/ui components
- Logging: Serilog → console (Railway logs in production)
- CORS: configurable via `appsettings.json` → `Cors:AllowedOrigins`

## ROADMAP.html Format
Task statuses: `done`, `progress`, `planned`, `future`
Badge classes: `badge-done`, `badge-progress`, `badge-planned`, `badge-future`
Phases: 1 (Scaffolding) → 2 (Auth) → 3 (Shop) → 4 (Items) → 5 (Offers) → 6 (Notifications) → 7 (Browse) → 8 (Polish)
