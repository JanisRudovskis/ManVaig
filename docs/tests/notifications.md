# Notification System — Test Cases

> Last updated: 2026-05-15

## Bell Icon & Badge

- [ ] Bell icon visible in TopBar (right of messages icon) when logged in
- [ ] Badge shows unread count (red circle, "99+" for 100+)
- [ ] Badge disappears when count is 0
- [ ] Badge updates in real-time via SignalR (NotificationCountChanged event)
- [ ] No bell icon when logged out

## Notification Dropdown

- [ ] Click bell opens dropdown with recent notifications
- [ ] Notifications load on dropdown open (lazy fetch)
- [ ] Opening dropdown marks all notifications as read (badge clears)
- [ ] Mark-all-read only fires after successful API call (not on dropdown open)
- [ ] Each notification shows item thumbnail (32px) or actor avatar fallback
- [ ] Each notification shows relative time ("Just now", "5m", "2h", "3d")
- [ ] Click notification navigates to correct page (item detail or user profile)
- [ ] Dropdown closes after clicking a notification
- [ ] "See all" button at bottom links to /notifications
- [ ] Empty state shows "No notifications yet" message
- [ ] Loading spinner while fetching
- [ ] Dropdown doesn't clip on mobile (375px viewport) — max-w-[calc(100vw-16px)]

## Full Notifications Page (/notifications)

- [ ] Shows all notifications with load-more pagination (20 per page)
- [ ] Item thumbnails are 40px with UserAvatar fallback
- [ ] Unread notifications have subtle background highlight (bg-muted/30)
- [ ] "Load more" button appears when more notifications exist
- [ ] Load more button disabled during fetch (prevents double-click)
- [ ] Error state with retry button on fetch failure
- [ ] Login-required state when not authenticated
- [ ] Skeleton loading (6 rows) on initial load
- [ ] Touch targets are at least 44px tall

## Notification Events

### NewBid (seller receives)
- [ ] Place a bid on another user's item
- [ ] Seller receives "X placed a bid of Y EUR on Z" notification
- [ ] Notification links to item detail page
- [ ] Item thumbnail shown in notification

### AuctionEnded (seller receives)
- [ ] Create a timed item with EndDate in the past (or wait for it to expire)
- [ ] AuctionEndedService detects it within 60 seconds
- [ ] Seller receives "Auction ended for X" notification
- [ ] Notification links to item detail page
- [ ] No duplicate notification if auction already processed (NOT EXISTS check)

### BidAccepted (bidder receives)
- [ ] Seller accepts a bid
- [ ] Bidder receives "Your bid was accepted for X" notification
- [ ] Notification links to item detail page

### NewItemFromFollowed (followers receive)
- [ ] Follow a user, then that user creates a new public item
- [ ] Follower receives "X posted a new item" notification
- [ ] Notification links to item detail page

### NewItemFromFollowed — Throttling
- [ ] Same seller creates 3 items within 1 hour
- [ ] Follower receives ONE notification with GroupCount=3 ("X posted 3 new items")
- [ ] Notification links to seller's profile page (not individual item)
- [ ] After 1 hour, new items create a fresh notification

## Background Services

### AuctionEndedService
- [ ] Polls every 60 seconds
- [ ] Only processes items with EndDate <= now AND AcceptOffers=true
- [ ] Skips items that already have an AuctionEnded notification
- [ ] SemaphoreSlim prevents overlapping ticks
- [ ] Visible in server logs on startup

### NotificationCleanupService
- [ ] Runs every 24 hours
- [ ] Deletes notifications older than 90 days
- [ ] Batch deletes (1000 at a time) to avoid long transactions

## SignalR Integration

- [ ] Single connection to /hubs/app serves both messages and notifications
- [ ] NotificationCountChanged event updates bell badge in real-time
- [ ] UnreadCountChanged event still updates messages badge
- [ ] Polling fallback (30s) works if SignalR connection fails
- [ ] Reconnection attempts on disconnect

## API Endpoints

### GET /api/v1/notifications
- [ ] Returns paginated list (default page=1, pageSize=20)
- [ ] Newest first (OrderByDescending CreatedAt)
- [ ] Includes actor display name and avatar
- [ ] Includes item title and primary image URL
- [ ] Includes bid amount for bid-related notifications
- [ ] Returns 401 when not authenticated

### POST /api/v1/notifications/read-all
- [ ] Marks all unread notifications as read
- [ ] Returns count of notifications marked as read
- [ ] Broadcasts NotificationCountChanged(0) via SignalR
- [ ] Returns 401 when not authenticated

### GET /api/v1/notifications/unread-count
- [ ] Returns { count: N } for unread notifications
- [ ] Returns 401 when not authenticated

## Edge Cases

- [ ] Deleted item — notification preserved (SetNull FK), shows without thumbnail
- [ ] Deleted actor — notification preserved, shows without avatar/name
- [ ] Self-action — no notification for your own actions (e.g., bidding on your own item is blocked by BidsController)
- [ ] Private items — NewItemFromFollowed only fires for Public visibility items
- [ ] Rapid creation — multiple items in quick succession don't cause race conditions (TOCTOU noted as acceptable risk)
