# Ralph Wiggum Loop — Autonomous Development Methodology

> **What:** A multi-agent autonomous development loop that takes a feature from analysis to ship-ready code.
> **When:** Use for medium-to-large features that touch both backend and frontend.
> **First used:** 2026-05-14 (Follow Users + My Page feature)

---

## Philosophy

Ralph is an **assembly line of specialists**, not one generalist doing everything. Each agent has a narrow focus, writes its findings to a shared living document, and passes the baton. The loop self-corrects — testers catch what developers miss, designers catch what testers don't look for, and the final decision maker ensures the whole thing fits the product.

**Key principles:**
- **Plan first, code after** — Analyzer + Expert run before any code is written
- **Parallel where possible** — Backend and frontend developers run simultaneously
- **Fix what you find** — Review agents produce actionable issues; fixes happen immediately
- **Document as you go** — The living doc builds up across phases, accessible to next iterations
- **Notify on completion** — User gets a push notification when done (or if blocked)

---

## Phase Structure

| Phase | Agent | Purpose | Parallel? |
|-------|-------|---------|-----------|
| 1 | **Analyzer** | Deep codebase analysis, write implementation spec | Can run with Phase 2 |
| 2 | **ManVaig Expert** | Audit spec against architecture, make design decisions | Can run with Phase 1 |
| 3 | **Backend Developer** | Implement models, migrations, API endpoints | Can run with Phase 4 |
| 4 | **Frontend Developer** | Implement components, pages, i18n | Can run with Phase 3 |
| — | **Verify** | Main agent reads key files, runs build/compile checks | Sequential |
| 5 | **Tester** | Smoke test — bugs, edge cases, logic errors | Can run with Phase 6 |
| 6 | **Design Reviewer** | UI/UX critique — mobile-first, accessibility, consistency | Can run with Phase 5 |
| — | **Fix** | Main agent applies fixes from Phase 5+6 findings | Sequential |
| 7 | **Final Decision Maker** | Ship/fix/reject decision against product mission | Sequential |
| — | **Notify** | Send PushNotification to user | Sequential |

**Typical timeline:** ~20-30 minutes for a medium feature (includes wake-up gaps).

### Context-Safe Execution Flow

Each phase group runs in a fresh context. The living doc is the **only bridge** between them.

```
┌─────────────────────────────────────┐
│ Context 1                           │
│ • Create living doc                 │
│ • Phase 1+2 (Analyzer + Expert)     │
│ • Write findings to living doc      │
│ • ScheduleWakeup (60s)              │
└──────────────┬──────────────────────┘
               ↓ fresh context
┌─────────────────────────────────────┐
│ Context 2                           │
│ • Read living doc → resume point    │
│ • Phase 3+4 (Backend + Frontend)    │
│ • Build verification                │
│ • Write progress to living doc      │
│ • ScheduleWakeup (60s)              │
└──────────────┬──────────────────────┘
               ↓ fresh context
┌─────────────────────────────────────┐
│ Context 3                           │
│ • Read living doc → resume point    │
│ • Phase 5+6 (Tester + Designer)     │
│ • Main agent applies fixes          │
│ • Write fixes to living doc         │
│ • ScheduleWakeup (60s)              │
└──────────────┬──────────────────────┘
               ↓ fresh context
┌─────────────────────────────────────┐
│ Context 4                           │
│ • Read living doc → resume point    │
│ • Phase 7 (Final Decision Maker)    │
│ • Apply final fixes if needed       │
│ • Update living doc → Complete      │
│ • Notify user                       │
└─────────────────────────────────────┘
```

**Why:** The first Ralph run (Follow Users) consumed the entire context window in one session, triggering compaction mid-loop. Option D prevents this by design — each context only holds ~2 phases worth of data.

---

## Agent Roles (Detailed)

### Phase 1: Analyzer
**Agent type:** `feature-dev:code-explorer`

**Input:** Feature description + user stories
**Output:** Implementation report with:
- Exact files to create/modify (with line references)
- Patterns to follow from existing code
- Pitfalls and edge cases
- Questions for the Expert
- Recommended implementation order

**Prompt template:**
```
You are the ANALYZER agent in a Ralph Wiggum development loop for [project].

## Your Task
Analyze the codebase to produce detailed implementation instructions for [feature].
Focus on:
1. Backend patterns — [specific patterns to study]
2. Controller patterns — [specific controllers to study]
3. Frontend data flow — [specific lib files to study]
4. [Feature-specific] architecture — [specific components/pages]
5. i18n patterns — [message files]

## Output Required
- Exact files to create/modify
- Patterns to follow (with line references)
- Pitfalls
- Implementation order
- Questions for Expert
Keep under 500 words.
```

---

### Phase 2: ManVaig Expert
**Agent type:** `feature-dev:code-architect`

**Input:** Feature description + questions from Analyzer
**Output:** Architecture decisions with:
- Answers to Analyzer's questions (opinionated, not wishy-washy)
- Architecture fit assessment
- Frontend architecture recommendations
- Visibility/security rules
- Migration safety check
- Scope recommendation for v1

**Key rule:** Be OPINIONATED. Make decisions, don't list options.

**Prompt template:**
```
You are the MANVAIG EXPERT agent. You know the project inside-out.

## Your Task
Audit this planned feature against the project's architecture and conventions.

Read these docs first:
- docs/ARCHITECTURE.md
- docs/PROJECT_SPEC.md
- docs/ROADMAP.html

Then answer:
### Architecture Fit
[3-4 specific architecture questions]
### Frontend Architecture Fit
[3-4 specific frontend questions]
### Visibility/Security Rules
[2-3 specific rules questions]
### Migration Safety
[1-2 safety questions]
### Scope
[1-2 scope questions]

Report recommendations in under 400 words. Be opinionated.
```

---

### Phase 3+4: Developers
**Agent type:** `general-purpose`

**Input:** Detailed implementation spec with exact code to write
**Output:** Working code — files created/modified, build passes

**Key rules:**
- Give EXACT code in the prompt — don't make the agent design the solution
- Tell it to read files BEFORE editing
- Tell it NOT to start servers
- Tell it to run build/compile at the end
- Backend and frontend agents run in PARALLEL (independent codebases)

**Prompt template:**
```
You are the DEVELOPER agent for [backend/frontend].

## What to Build
### 1. Create [file path]
[exact code]
### 2. Update [file path]
[exact changes with context]
...

## IMPORTANT RULES
- Read each file BEFORE editing
- Follow the EXACT patterns in existing code
- Do NOT start any servers
- Run build/compile at the end
- Report what you did and any issues
```

---

### Phase 5: Tester
**Agent type:** `feature-dev:code-reviewer`

**Input:** List of files to review + specific checks
**Output:** Issue table with severity, file, line, description, fix

**Focus areas:**
- Logic errors (self-referential checks, null handling)
- Edge cases (race conditions, concurrent access)
- Integration issues (FK cascade, state sync)
- Auth bypass risks
- Missing validation

**Key rule:** Test at FEATURE level only — don't test every service.

---

### Phase 6: Design Reviewer
**Agent type:** `feature-dev:code-reviewer`

**Input:** UI component files + design criteria
**Output:** Issues with severity + what works well + priority fixes

**Focus areas:**
- Mobile-first (44px touch targets, 375px layout)
- Accessibility (aria labels, focus management, touch vs hover)
- Consistency with existing design system
- Empty states, loading states, error states
- Visual hierarchy and discoverability

---

### Phase 7: Final Decision Maker
**Agent type:** `feature-dev:code-reviewer`

**Input:** All files + list of issues found/fixed + product context
**Output:** SHIP / FIX FIRST / REJECT with reasoning

**Checklist:**
1. Does this fit the product mission?
2. Is scope appropriate for v1?
3. Architecture consistency?
4. Mobile-first?
5. i18n completeness?
6. Performance (N+1, missing indexes)?
7. Security (auth bypass, race conditions)?

---

## Living Document Template

Each Ralph loop creates a `docs/ralph-[feature-name].md` file:

```markdown
# Ralph Loop: [Feature Name]

> **Living document** — builds up across iterations.
> **Started:** [date]
> **Status:** [In Progress / Complete]

## Task Overview
[User stories + constraints]

## Iteration Log
[Status of each phase]

## Implementation Spec
[Written by Analyzer, reviewed by Expert]

## Development Progress
[Checklist updated by Developer]

## Testing Notes
[Issues found + verified correct items]

## Design Review Notes
[Issues found + what works well]

## Final Decision
[SHIP/FIX/REJECT with reasoning table]

## Resume Point
**Next phase:** [Phase number + name]
**Context group:** [1-4]
**What's done:** [Quick summary of completed phases]
**What's needed next:** [Brief description of next steps]

## Issues / Blockers
[Any unresolved problems]
```

---

## Lessons Learned (from first run)

### What worked well
1. **Parallel agents saved time** — Analyzer+Expert ran together, Backend+Frontend ran together, Tester+Designer ran together
2. **Living document** — each phase could see what previous phases decided
3. **Exact code in developer prompts** — agents don't have to design, just implement
4. **Code reviewer agent for testing** — better at finding real bugs than a general agent
5. **Build verification between phases** — caught issues early

### What to improve
1. **Context window exhaustion** — the first run consumed the entire context in one session. Now solved with Option D: planned wake-ups between phase groups, living doc as the only bridge.
2. **Mobile unfollow was a critical miss** — the developer agent didn't think about touch devices. Include "mobile interaction patterns" in the developer prompt.
3. **Race condition found late** — Final Decision Maker caught it, but Tester should have. Add "concurrent access" to Tester's explicit checklist.
4. **ntfy limitation** — PushNotification only works with Remote Control active. Warn user if not connected.

### Anti-patterns to avoid
- Don't let agents design the solution — give them exact code
- Don't skip the Expert phase — it catches architecture mismatches early
- Don't combine Tester and Designer — they look for different things
- Don't skip build verification — agents sometimes claim success without checking

---

## How to Invoke

User says something like:
```
I want to build [feature]. Use the Ralph loop.
```

Or for the full setup:
```
Create a ralph wiggum loop for [feature].
Agents: Analyzer, Expert, Developer, Tester, Design reviewer, Final decision maker.
Send ntfy when done.
```

The main agent (Claude) orchestrates the loop, spawning specialized agents for each phase and fixing issues between phases.

---

## Context Management

### The Problem
A medium feature (7 agents + fixes) fills the entire context window. The first Ralph run hit compaction mid-loop, losing conversational context.

### The Solution: Living Doc as Only Bridge
Each phase group runs in a **fresh context**. The main agent writes all findings to the living doc after each group, then calls `ScheduleWakeup(60)` to get a clean slate. On wake-up, it reads the living doc and continues from the `## Resume Point` section.

### Rules for Context Hygiene
1. **Agents return short summaries only** — file list + issues, under 300 words. No full code in responses.
2. **All detailed findings go to the living doc**, not kept in conversation memory.
3. **After each phase group**, update the living doc's `Resume Point` before waking up.
4. **On wake-up**, read the living doc first, then the specific files needed for the next phase.
5. **Never accumulate more than 2 phases** in a single context.

### Wake-up Prompt Template
```
Resume Ralph Wiggum loop for [feature].
Read docs/ralph-[feature].md and continue from the Resume Point.
Follow docs/ralph-loop-guide.md methodology.
```

### Token Exhaustion (different from planned wake-ups)
If tokens run low unexpectedly mid-phase:
- Write current progress to the living doc immediately
- Use `ScheduleWakeup(1200)` (20 min for token renewal)
- On resume, read the doc and continue from where you left off

---

*This guide is updated after each Ralph loop run with new lessons learned.*
