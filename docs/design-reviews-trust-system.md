# Design: Reviews + Trust System

> **Status:** Design complete, waiting for implementation
> **Prerequisite:** Item transaction flow must be completed first (offer accepted → sold)
> **Planned approach:** Ralph Wiggum Loop (reviews + trust as one feature)
> **Designed:** 2026-05-15

---

## Goal

Users should be able to assess seller trustworthiness **without opening their profile**. A visual trust signal (avatar ring) appears everywhere avatars are shown — item cards, search results, profile popups.

---

## Reviews (v1)

- **Who can review:** Buyer only (after an accepted offer)
- **What:** Star rating (1-5) + optional text comment
- **Limit:** One review per offer (can't review same transaction twice)
- **Direction:** Buyer reviews seller only (not both ways in v1)
- **Where visible:** Seller's profile page (full list), ProfilePopup (count + average)

### Why Offer-Based Only

Fake review prevention. The offer system has real friction — listing, negotiation, acceptance. To fake a review you'd need to create a listing, make an offer from another account, accept it, then review. This is the strongest anti-fake approach for v1.

Other transaction types (direct contact, meet-ups) can't leave reviews in v1. This also pushes users toward using the offer system, which is good for the platform.

### Open Questions

1. **Offer status** — does the offer system have an "accepted" state to hook into? Need to verify.
2. **Timing** — can buyer review immediately after offer accepted, or should there be a delay / "mark as received" step?
3. **Transparency** — can seller see who left what review? (transparency vs anonymity)

---

## Trust Points (v1)

Points are calculated from reviews only.

| Rating | Points |
|--------|--------|
| 5 stars | +3 |
| 4 stars | +2 |
| 3 stars | +1 |
| 2 stars | -1 |
| 1 star | -2 |

Thresholds are a starting point — tune based on how fast reviews accumulate.

---

## Trust Tiers (v1)

| Tier | Points Required | Avatar Ring Color |
|------|----------------|-------------------|
| New | 0 | No ring (default) |
| Active | 5+ | Blue |
| Trusted | 20+ | Green |
| Top Seller | 50+ | Gold |

---

## Visual Design

### Avatar Ring
- Colored border around user's avatar based on trust tier
- Appears **everywhere** avatars are shown: item cards, search results, ProfilePopup, profile page
- Zero extra UI space — modifies existing UserAvatar component
- Accessibility: consider adding a small icon or pattern for color-blind users

### ProfilePopup
- Shows tier name + review count + average rating
- Example: "Trusted Seller - 4.7 (23 reviews)"

### Profile Page
- Full trust breakdown: tier, total points, review count, average rating
- Full reviews list with star rating + text + reviewer name + date

### Mobile Considerations
- No tooltips (hover doesn't work on touch)
- Avatar ring is self-explanatory — color speaks for itself
- Tap avatar → ProfilePopup shows trust details
- Tap "View Profile" → full breakdown

---

## Not in v1

- Dispute system (AI review of bad reviews)
- Seller reviews buyer (both-way reviews)
- Non-offer review paths (mutual confirmation for off-platform deals)
- Search ranking boost for trusted sellers
- Non-review point sources (account age, completed sales, profile completeness, verified email)

---

## Implementation Plan (for Ralph Loop)

### Backend
- Review model (FK to Offer + Reviewer + Seller, rating, text, createdAt)
- ReviewController (POST review, GET reviews for user)
- Trust calculation (computed from reviews, cached or real-time TBD)
- Extend ProfileController with trust tier + review stats
- Extend UserProfileResponse DTO

### Frontend
- Leave Review UI (after accepted offer)
- Reviews list on profile page
- Avatar ring component (wrap UserAvatar)
- Trust info in ProfilePopup
- Trust breakdown section on profile page
- i18n keys (EN + LV)

---

*Return to this document when item transaction flow is complete.*
