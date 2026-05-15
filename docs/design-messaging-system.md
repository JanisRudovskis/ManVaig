# Design: Messaging System

> **Status:** Design complete, ready for Ralph loop
> **Prerequisite:** None — can be built now
> **Planned approach:** Ralph Wiggum Loop
> **Designed:** 2026-05-15

---

## Goal

Buyers and sellers need to communicate — negotiate price, arrange meetups, ask questions. The messaging system replaces the need for contact info reveal (email) on bid acceptance. Contact reveal remains only for anonymous bidders who don't have a profile to message.

This is also a prerequisite for the revised offer→sold transaction flow:
1. Bids come in
2. Seller messages bidders through in-app messaging
3. Transaction happens IRL
4. Seller marks the winning bid as accepted (= deal done, item sold)
5. Buyer can leave a review (future)

---

## v1 Scope

- **User-to-user conversations** — one thread per user pair (like Facebook Messenger), not item-scoped
- **Item links in messages** — clicking "Message Seller" from an item page auto-inserts an item link in the message
- **Text only** — no images, files, or attachments
- **Max message length:** 2000 characters
- **Rate limiting:** 20 messages per minute per user
- **Real-time** via SignalR (WebSocket with fallback)
- **Read/unread** status per message
- **Top bar** with messages icon + unread badge (Facebook-style, right corner)
- **Two-user only** — no group chats

---

## Data Model

### Conversation

```
Conversation
  - Id (Guid, PK)
  - User1Id (Guid, FK → ApplicationUser) — first participant (the one who initiated)
  - User2Id (Guid, FK → ApplicationUser) — second participant
  - CreatedAt (DateTime)
  - LastMessageAt (DateTime, nullable) — for inbox sorting
  - Index: IX_Conversations_User1Id
  - Index: IX_Conversations_User2Id
```

**Deduplication:** When creating a conversation, check both directions — (A, B) and (B, A). If either exists, return the existing one. No duplicate threads between the same two users.

**No unique constraint on (User1Id, User2Id)** — enforce deduplication in the controller logic instead, since we need to check both orderings anyway.

### Message

```
Message
  - Id (Guid, PK)
  - ConversationId (Guid, FK → Conversation)
  - SenderId (Guid, FK → ApplicationUser)
  - Text (string, max 2000 chars)
  - IsRead (bool, default false) — "recipient has seen this"
  - CreatedAt (DateTime)
  - Index: IX_Messages_ConversationId_CreatedAt
```

**IsRead semantics:** Since conversations are always between two users, IsRead means "the non-sender has seen this message." Sender's own messages don't need read tracking.

### ApplicationUser Navigation Properties

```csharp
public ICollection<Conversation> ConversationsAsUser1 { get; set; } = new List<Conversation>();
public ICollection<Conversation> ConversationsAsUser2 { get; set; } = new List<Conversation>();
```

---

## Backend

### New NuGet Package

None needed — `Microsoft.AspNetCore.SignalR` is included in `Microsoft.NET.Sdk.Web` (ASP.NET Core 9).

### SignalR Hub: `Hubs/ChatHub.cs`

```csharp
[Authorize]
public class ChatHub : Hub
{
    // On connect: client joins a personal group "user_{userId}"
    // This way we can push messages to a user regardless of which conversation they're viewing
    //
    // Methods:
    //   JoinConversation(conversationId) — validates user is participant, joins "conversation_{id}" group
    //   LeaveConversation(conversationId) — leaves group
    //
    // Server-to-client events:
    //   ReceiveMessage(message) — new message in a conversation
    //   MessagesRead(conversationId, readByUserId) — other party read messages
    //   UnreadCountChanged(count) — global unread count updated (pushed to user's personal group)
}
```

**JWT auth for SignalR:** WebSockets can't send headers after handshake. Standard pattern — pass JWT as query string parameter during connection, configure in `Program.cs`:

```csharp
.AddJwtBearer(options =>
{
    // ... existing config ...
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/chat"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});
```

### CORS Update: `Program.cs`

SignalR WebSockets require credentials:

```csharp
policy.WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials(); // NEW — required for SignalR
```

### Map Hub: `Program.cs`

```csharp
app.MapHub<ChatHub>("/hubs/chat");
```

### Rate Limiting

**20 messages per minute per user.** In-memory `ConcurrentDictionary<Guid, List<DateTime>>` in the controller (same pattern as forgot-password rate limiting). Returns 429 with `retryAfter` if exceeded. Sliding window — drop entries older than 60 seconds.

### Controller: `ConversationsController.cs`

Route: `/api/v1/conversations`

| Endpoint | Auth | What it does |
|----------|------|-------------|
| `GET /` | Bearer | List user's conversations (inbox). Sorted by LastMessageAt desc. Includes: other user info (avatar, displayName), last message preview, unread count per conversation. Paginated. |
| `GET /{id}/messages` | Bearer | Get messages for a conversation. Validates user is participant. Paginated (newest first, client reverses). |
| `POST /` | Bearer | Start or get existing conversation. Body: `{ participantId }`. Checks both directions for existing. Cannot message yourself. Returns conversation. |
| `POST /{id}/messages` | Bearer | Send a message. Body: `{ text }`. Max 2000 chars. Validates participant. Rate limited (20/min). Creates message, updates LastMessageAt, broadcasts via SignalR. |
| `POST /{id}/read` | Bearer | Mark all messages in conversation as read (where sender != current user). Broadcasts read event via SignalR. |
| `GET /unread-count` | Bearer | Returns total unread message count across all conversations. For top bar badge. |

### DTOs

```csharp
// Request
public class StartConversationRequest
{
    public Guid ParticipantId { get; set; }
}

public class SendMessageRequest
{
    [Required, MaxLength(2000)]
    public string Text { get; set; } = "";
}

// Response
public class ConversationListItem
{
    public Guid Id { get; set; }
    public Guid OtherUserId { get; set; }
    public string OtherUserDisplayName { get; set; } = "";
    public string? OtherUserAvatarUrl { get; set; }
    public string? LastMessageText { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
}

public class ConversationResponse
{
    public Guid Id { get; set; }
    public Guid OtherUserId { get; set; }
    public string OtherUserDisplayName { get; set; } = "";
    public string? OtherUserAvatarUrl { get; set; }
    public List<MessageResponse> Messages { get; set; } = new();
    public int TotalMessages { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class MessageResponse
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public string SenderDisplayName { get; set; } = "";
    public string? SenderAvatarUrl { get; set; }
    public string Text { get; set; } = "";
    public bool IsRead { get; set; }
    public bool IsOwnMessage { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class InboxResponse
{
    public List<ConversationListItem> Conversations { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
```

---

## Frontend

### New npm Package

```
@microsoft/signalr
```

### API Functions: `lib/messages.ts`

```typescript
getConversations(page?: number): Promise<InboxResponse>
getMessages(conversationId: string, page?: number): Promise<ConversationResponse>
startConversation(participantId: string): Promise<{ id: string }>
sendMessage(conversationId: string, text: string): Promise<MessageResponse>
markAsRead(conversationId: string): Promise<void>
getUnreadCount(): Promise<{ count: number }>
```

### SignalR Hook: `hooks/use-chat.ts`

- Establishes SignalR connection on mount (with JWT token)
- Joins user's personal group on connect (for unread count updates)
- Joins conversation group when viewing a specific chat
- Receives real-time messages → updates local state
- Handles reconnection (SignalR automatic reconnect)
- Exposes: `messages`, `sendMessage()`, `isConnected`, `connectionState`

### Unread Count Hook: `hooks/use-unread-count.ts`

- Listens to SignalR `UnreadCountChanged` events via user's personal group
- Fallback: poll `GET /conversations/unread-count` every 30s if SignalR disconnects
- Used by top bar for badge number

---

## Top Bar

### Layout: `components/top-bar.tsx`

A persistent header bar across the app, positioned above the main content area (to the right of the sidebar on desktop, full-width on mobile).

**v1 contents:** Messages icon only (right-aligned). More items (notifications, etc.) will be added later.

### Messages Icon + Popover

- **Icon:** `MessageCircle` from lucide-react
- **Unread badge:** red dot/number on the icon (driven by `use-unread-count` hook)
- **Click:** opens a popover/dropdown showing recent conversations (last 5-8)
  - Each row: other user avatar + name, last message preview (truncated), relative time, unread indicator
  - Click a conversation → navigate to `/messages/[id]`
  - "See all messages" link at bottom → navigate to `/messages`
- **Mobile:** same popover, or navigate directly to `/messages` on tap (depending on screen size)
- **Only visible when logged in**

### Where It Goes

- Desktop: fixed bar above `<main>`, to the right of sidebar — doesn't overlap sidebar content
- Mobile: fixed bar at top, above page content — visible alongside the mobile sidebar toggle

---

## Pages

### Inbox: `/messages` (`app/messages/page.tsx`)

- Full conversation list sorted by last message time
- Each row: other user avatar + name, last message preview (truncated), relative time, unread dot/count
- Click → navigate to `/messages/[id]`
- Empty state: "No messages yet — start a conversation from an item page"
- Mobile: full-width list
- Desktop: max-w-2xl centered (consistent with My Page)

### Chat: `/messages/[id]` (`app/messages/[id]/page.tsx`)

- Header: back arrow + other user avatar + name (tappable → their profile)
- Message thread: bubbles, own messages right-aligned, theirs left-aligned
- Input bar at bottom: text input (max 2000 chars) + send button
- Enter to send, Shift+Enter for newline
- Auto-scroll to bottom on new messages
- Mark as read on open (and on new incoming messages while chat is visible)
- Load older messages on scroll to top (pagination)
- Character counter appears near limit (like bio field pattern)
- Mobile: full-screen chat view
- Desktop: same, max-width constrained

---

## Entry Points (how users start a conversation)

### Item Detail Page — "Message Seller" button
- Visible to non-owners on public item pages
- Click → starts/gets conversation with seller → navigates to `/messages/[id]`
- **Auto-inserts item link** as first message: "Hi, I'm interested in [Item Title](/items/[id])" (pre-filled, user can edit before sending)
- If conversation already exists with this seller, just opens it (no auto-message)

### Offers Page — "Message" button per bidder
- Visible to item owner on the offers page, next to each non-anonymous bidder
- Click → starts/gets conversation with that bidder → navigates to `/messages/[id]`
- **Auto-inserts item link** as first message: "Hi, about your offer on [Item Title](/items/[id])" (pre-filled, editable)
- If conversation already exists, just opens it

### Profile Page — "Message" button
- Visible on other users' public profiles
- Click → starts/gets conversation → navigates to `/messages/[id]`
- No auto-inserted item link (profile-level messaging has no item context)

---

## Components

- `TopBar` — persistent header bar, messages icon + popover
- `MessagesPopover` — dropdown with recent conversations
- `ConversationListItem` — row in inbox / popover
- `ChatView` — message thread + input
- `MessageBubble` — single message (own vs other styling)
- `MessageInput` — text input + send button (Enter to send, Shift+Enter for newline, 2000 char limit)

---

## i18n Keys (EN + LV)

### English
```
messages.title: "Messages"
messages.inbox: "Inbox"
messages.noConversations: "No messages yet"
messages.noConversationsHint: "Start a conversation from an item page"
messages.typeMessage: "Type a message..."
messages.send: "Send"
messages.you: "You"
messages.messageSeller: "Message Seller"
messages.messageBidder: "Message"
messages.messageUser: "Message"
messages.seeAll: "See all messages"
messages.unreadCount: "{count} unread"
messages.loadOlder: "Load older messages"
messages.justNow: "Just now"
messages.connectionLost: "Connection lost. Reconnecting..."
messages.connectionRestored: "Connected"
messages.rateLimited: "Too many messages. Please wait."
messages.tooLong: "Message is too long (max 2000 characters)"
messages.autoItemLink: "Hi, I'm interested in {itemTitle}"
messages.autoOfferLink: "Hi, about your offer on {itemTitle}"
```

### Latvian
```
messages.title: "Ziņojumi"
messages.inbox: "Iesūtne"
messages.noConversations: "Vēl nav ziņojumu"
messages.noConversationsHint: "Sāciet sarunu no preces lapas"
messages.typeMessage: "Rakstiet ziņojumu..."
messages.send: "Sūtīt"
messages.you: "Jūs"
messages.messageSeller: "Rakstīt pārdevējam"
messages.messageBidder: "Rakstīt"
messages.messageUser: "Rakstīt"
messages.seeAll: "Skatīt visus ziņojumus"
messages.unreadCount: "{count} nelasīti"
messages.loadOlder: "Ielādēt vecākus ziņojumus"
messages.justNow: "Tikko"
messages.connectionLost: "Savienojums zaudēts. Atjaunošana..."
messages.connectionRestored: "Savienots"
messages.rateLimited: "Pārāk daudz ziņojumu. Lūdzu, uzgaidiet."
messages.tooLong: "Ziņojums ir pārāk garš (maks. 2000 rakstzīmes)"
messages.autoItemLink: "Sveiki, mani interesē {itemTitle}"
messages.autoOfferLink: "Sveiki, par jūsu piedāvājumu — {itemTitle}"
```

---

## Not in v1

- Image/file sharing in messages
- Group chats
- Message editing or deletion
- Message search
- Blocking users
- Read receipts with timestamps ("seen at 14:32")
- Typing indicators
- Push notifications (browser/mobile) — comes with Phase 6
- Message reactions/emoji
- Link previews (item card embed in message)

---

## Decisions Made

1. **User-to-user, not item-scoped** — one conversation per user pair. When starting from an item page, item link is auto-inserted as a message, not tied to the conversation model.
2. **Rate limiting: 20 messages/min** — simple sliding window, in-memory. Returns 429.
3. **Message max length: 2000 characters** — with char counter near limit.
4. **Top bar, not sidebar** — messages icon in a new persistent top bar (right corner), Facebook-style. Top bar only has messages for now, expandable later.
5. **No time gate on failed deals** — trust the seller. Buyer recourse is reviews (future).

---

## Implementation Plan (for Ralph Loop)

### Backend
- Conversation + Message models
- EF migration (new tables + indexes)
- AppDbContext configuration (relationships, constraints)
- SignalR ChatHub (JWT auth, user groups, conversation groups)
- Program.cs updates (SignalR mapping, CORS AllowCredentials, JWT OnMessageReceived event)
- ConversationsController (all 6 endpoints + rate limiting)
- DTOs (request + response)

### Frontend
- Install `@microsoft/signalr`
- `lib/messages.ts` (API functions)
- `hooks/use-chat.ts` (SignalR connection + real-time messages)
- `hooks/use-unread-count.ts` (badge count via SignalR + polling fallback)
- Top bar component + messages icon popover
- Layout update to include top bar
- Inbox page (`/messages`)
- Chat page (`/messages/[id]`)
- Components: ConversationListItem, ChatView, MessageBubble, MessageInput
- "Message Seller" button on item detail page (with auto item link)
- "Message" button on offers page per bidder (with auto item link)
- "Message" button on profile page
- i18n keys (EN + LV)

---

*This document is the feature spec input for the Ralph Wiggum Loop.*
