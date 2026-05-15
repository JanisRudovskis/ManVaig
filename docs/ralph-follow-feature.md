# Ralph Loop: Follow Users + My Page

> **Living document** — builds up across iterations. Each agent reads this, adds findings, and passes to the next.
> **Started:** 2026-05-14
> **Status:** ✅ Complete — ready for user review
> **Completed:** 2026-05-14

---

## Task Overview

Build a "Follow Users" system (Facebook-style) and a "My Page" personal dashboard.

### User Stories
1. **As a user**, I can follow another user from their profile page
2. **As a user**, I can unfollow a user I'm following
3. **As a user**, I can see who follows me (followers list)
4. **As a user**, I can see who I follow (following list)
5. **As a user**, I can navigate to a user's profile from search results (item cards, people tab)
6. **As a user**, I have a "My Page" dashboard where I can see my followers, following, and other personal info
7. **As a user**, I see follower/following counts on profiles

### Constraints
- Mobile-first, but also good on desktop
- Cozy, intuitive UI/UX — no overkill
- Must work with existing auth system (JWT, `[Authorize]` / `[AllowAnonymous]`)
- i18n: English + Latvian
- Reuse existing components where possible (UserAvatar, ProfilePopup, etc.)

---

## Iteration Log

### Iteration 1: Analyzer
- **Status:** ✅ Done
- **Agent:** Analyzer
- **Goal:** Study codebase, write detailed implementation spec
- **Output:** See "Implementation Spec" section below

### Iteration 2: ManVaig Expert Review
- **Status:** ✅ Done
- **Agent:** ManVaig Expert
- **Goal:** Audit spec against ManVaig architecture, patterns, conventions

### Iteration 3: Backend Development
- **Status:** ✅ Done
- **Agent:** Developer
- **Goal:** UserFollow model, migration, API endpoints

### Iteration 4: Frontend Development
- **Status:** ✅ Done
- **Agent:** Developer
- **Goal:** Follow button, My Page, followers/following views

### Iteration 5: Smoke Testing
- **Status:** ✅ Done
- **Agent:** Tester
- **Goal:** Feature-level smoke tests

### Iteration 6: Design Review
- **Status:** ✅ Done
- **Agent:** Design Skill
- **Goal:** UI/UX critique

### Iteration 7: Final Decision
- **Status:** ✅ Done
- **Agent:** Final Decision Maker
- **Goal:** Does solution fit ManVaig mission?

---

## Implementation Spec

*(Written by Analyzer, reviewed by ManVaig Expert)*

### Backend

#### New Model: `UserFollow`
```
UserFollow
  - FollowerId (Guid, FK → ApplicationUser) — the person doing the following
  - FolloweeId (Guid, FK → ApplicationUser) — the person being followed
  - CreatedAt (DateTime)
  - Composite PK: (FollowerId, FolloweeId)
  - Index: IX_UserFollows_FolloweeId (for "who follows me" queries)
```

#### ApplicationUser Navigation Properties
```csharp
public ICollection<UserFollow> Following { get; set; } = new List<UserFollow>(); // users I follow
public ICollection<UserFollow> Followers { get; set; } = new List<UserFollow>(); // users who follow me
```

#### AppDbContext Configuration
```csharp
builder.Entity<UserFollow>(entity =>
{
    entity.HasKey(uf => new { uf.FollowerId, uf.FolloweeId });
    
    entity.HasOne(uf => uf.Follower)
        .WithMany(u => u.Following)
        .HasForeignKey(uf => uf.FollowerId)
        .OnDelete(DeleteBehavior.Cascade);
    
    entity.HasOne(uf => uf.Followee)
        .WithMany(u => u.Followers)
        .HasForeignKey(uf => uf.FolloweeId)
        .OnDelete(DeleteBehavior.Restrict); // prevent cascade loop
    
    entity.HasIndex(uf => uf.FolloweeId);
});
```

#### New Controller: `FollowController.cs`

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `POST /api/v1/users/{displayName}/follow` | Bearer | Follow a user. Idempotent (no error if already following). Cannot follow yourself. |
| `DELETE /api/v1/users/{displayName}/follow` | Bearer | Unfollow a user. Idempotent. |
| `GET /api/v1/users/{displayName}/followers` | AllowAnonymous | Get paginated follower list. Private profile + anonymous → empty. |
| `GET /api/v1/users/{displayName}/following` | AllowAnonymous | Get paginated following list. Private profile + anonymous → empty. |
| `GET /api/v1/users/{displayName}/follow-status` | Bearer | Returns `{ isFollowing: bool }` for current user → target. |

#### Extend Existing Endpoints
- `ProfileController.MapToResponse` → add `followerCount`, `followingCount` to `UserProfileResponse`
- `ProfileController.GetPublicProfile` → add `isFollowedByMe` (bool, null for anonymous) — saves an extra API call

#### DTOs
```csharp
public class FollowUserDto
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public DateTime FollowedSince { get; set; }
}

public class FollowListResponse
{
    public List<FollowUserDto> Users { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
```

### Frontend

#### API Functions (`lib/auth.ts` or new `lib/follows.ts`)
```typescript
followUser(displayName: string): Promise<void>
unfollowUser(displayName: string): Promise<void>
getFollowers(displayName: string, page?: number): Promise<FollowListResponse>
getFollowing(displayName: string, page?: number): Promise<FollowListResponse>
```

#### Follow Button Component (`components/follow-button.tsx`)
- Shows "Follow" / "Following" state
- Toggle behavior: click "Following" → shows "Unfollow" on hover (desktop) or becomes toggle (mobile)
- Requires auth — opens login dialog if not logged in
- Optimistic UI update (instant state change, rollback on error)

#### Public Profile Page Changes (`app/user/[displayName]/page.tsx`)
- Add follower/following counts to profile stats
- Add Follow button (for non-owner view)
- Add "Followers" and "Following" tabs/links

#### My Page (`app/my-page/page.tsx`)
- New sidebar nav item
- Sections:
  - Profile summary card (avatar, name, stats)
  - Followers tab (list of followers with UserAvatar + displayName + follow-back button)
  - Following tab (list of following with unfollow button)
- Mobile: single column, tabs at top
- Desktop: same layout, max-w-2xl centered

#### Search Integration
- People tab cards already link to `/user/{displayName}` — no change needed
- Item cards already have seller info → clicking seller name/avatar opens ProfilePopup → profile page has follow button

#### i18n Keys Needed
- `follow.follow` / `follow.following` / `follow.unfollow`
- `follow.followers` / `follow.followingTab`
- `follow.followerCount` (plural-aware ICU)
- `follow.followingCount` (plural-aware ICU)
- `follow.noFollowers` / `follow.noFollowing`
- `myPage.title` / `myPage.followers` / `myPage.following`
- `myPage.description` (empty state text)

---

## Development Progress

*(Updated by Developer agent)*

### Backend
- [x] UserFollow model created
- [x] EF migration created
- [x] FollowController created
- [x] ProfileController extended (counts + isFollowedByMe)
- [x] Backend compiles and migration tested

### Frontend
- [x] Follow API functions created
- [x] FollowButton component created
- [x] Public profile page updated (follow button + counts)
- [x] My Page created
- [x] ProfilePopup updated (follow button)
- [x] i18n keys added (EN + LV)
- [x] Sidebar navigation updated

---

## Testing Notes

*(Updated by Tester agent)*

### Issues Found & Fixed
1. ✅ **FollowButton stale state** — `useState(initialIsFollowing)` didn't sync when prop changed. Fixed with `useEffect`.
2. ✅ **My Page blank page** — unauthenticated user dismissing login dialog saw empty page. Fixed with login-required fallback UI.
3. ⚠️ **Restrict on Followee FK** — will block account deletion if user has followers. Accepted for v1 (account deletion not implemented yet).
4. ⚠️ **Private profile followers visible to authenticated** — matches existing pattern for all private profile data.

### Verified Correct
- Self-follow prevention (CANNOT_FOLLOW_SELF)
- Idempotent follow/unfollow
- Composite PK prevents duplicates
- DB index on FolloweeId
- Follow button hidden on own profile
- Count updates server-confirmed (not optimistic)
- isFollowedByMe null for anonymous
- Pagination clamping on list endpoints

---

## Design Review Notes

*(Updated by Design agent)*

### Issues Found & Fixed
1. ✅ **Mobile unfollow UX broken** — hover-to-reveal doesn't work on touch. Fixed with `useIsMobile()` tap-to-toggle.
2. ✅ **Wrong icon** — `UserPlus` used for unfollow action. Fixed to `UserMinus`.
3. ✅ **Silent error on follow failure** — `followError` i18n key existed but unused. Now wired up with auto-dismiss.
4. ✅ **followerCount > 0 gate** — hid counts for anonymous visitors. Gate removed.
5. ⚠️ **Quick-link buttons use raw `<button>`** — minor inconsistency with shadcn Button. Accepted for v1.

### What Works Well
- Loading state prevents layout shift (min-w-[100px])
- Tab switcher consistent with existing design language
- Follower list rows mobile-safe (truncate, min-w-0)

---

## Final Decision

**VERDICT: SHIP** (after one fix applied)

### Race Condition Fix
- Concurrent POST /follow could violate composite PK → unhandled 500
- Fixed: wrapped SaveChangesAsync in try/catch for DbUpdateException
- Idempotent outcome preserved

### Evaluation
| Check | Result |
|---|---|
| Fits ManVaig mission? | ✅ Social layer benefits sellers (visibility) and buyers (discovery) |
| Scope appropriate for v1? | ✅ Minimal: 1 model, 1 controller, 1 page, 1 component |
| Architecture consistent? | ✅ Follows all existing patterns (composite PK, AllowAnonymous, DTOs) |
| Mobile-first? | ✅ Touch targets adequate, responsive layout |
| i18n complete? | ✅ All strings in EN + LV |
| Performance? | ✅ Indexed queries, COUNT on indexed columns |
| Security? | ✅ Authorize on mutations, race condition handled |

---

## Issues / Blockers

None remaining. All issues resolved.
