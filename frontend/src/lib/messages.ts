import { authFetch, getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export interface ConversationListItem {
  id: string;
  otherUserId: string;
  otherUserDisplayName: string;
  otherUserAvatarUrl: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageResponse {
  id: string;
  senderId: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  text: string;
  isRead: boolean;
  isOwnMessage: boolean;
  createdAt: string;
}

export interface ConversationResponse {
  id: string;
  otherUserId: string;
  otherUserDisplayName: string;
  otherUserAvatarUrl: string | null;
  messages: MessageResponse[];
  totalMessages: number;
  page: number;
  pageSize: number;
}

export interface InboxResponse {
  conversations: ConversationListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getConversations(page = 1): Promise<InboxResponse> {
  const res = await authFetch(`${API_URL}/api/v1/conversations?page=${page}`);
  if (!res.ok) throw new Error("conversations_fetch_failed");
  return res.json();
}

export async function getMessages(conversationId: string, page = 1): Promise<ConversationResponse> {
  const res = await authFetch(`${API_URL}/api/v1/conversations/${conversationId}/messages?page=${page}`);
  if (!res.ok) throw new Error("messages_fetch_failed");
  return res.json();
}

export async function startConversation(participantId: string): Promise<{ id: string }> {
  const res = await authFetch(`${API_URL}/api/v1/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const body = await res.json();
      throw new Error(body.error ?? "start_conversation_failed");
    }
    throw new Error("start_conversation_failed");
  }
  return res.json();
}

export async function sendMessage(conversationId: string, text: string): Promise<MessageResponse> {
  const res = await authFetch(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error("send_message_failed");
  return res.json();
}

export async function markAsRead(conversationId: string): Promise<void> {
  await authFetch(`${API_URL}/api/v1/conversations/${conversationId}/read`, {
    method: "POST",
  });
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const res = await authFetch(`${API_URL}/api/v1/conversations/unread-count`);
  if (!res.ok) return { count: 0 };
  return res.json();
}
