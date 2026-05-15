"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getMessages, sendMessage, markAsRead, type ConversationResponse, type MessageResponse } from "@/lib/messages";
import { getToken } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { MessageBubble } from "@/components/message-bubble";
import { MessageInput } from "@/components/message-input";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("messages");
  const { isLoggedIn, isLoading, user } = useAuth();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<any>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load messages
  useEffect(() => {
    if (isLoading || !isLoggedIn || !conversationId) return;

    setLoading(true);
    getMessages(conversationId)
      .then((data) => {
        setConversation(data);
        // Messages come newest-first from API, reverse for display
        setMessages(data.messages.reverse());
        // Mark as read
        markAsRead(conversationId).catch(() => {});
      })
      .catch(() => setError("error"))
      .finally(() => setLoading(false));
  }, [conversationId, isLoggedIn, isLoading]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages.length, scrollToBottom]);

  // SignalR connection for real-time messages
  useEffect(() => {
    if (!isLoggedIn || !conversationId) return;

    let stopped = false;
    (async () => {
      try {
        const signalR = await import("@microsoft/signalr");
        const token = getToken();
        if (!token || stopped) return;

        const hubUrl = API_URL.replace(/\/$/, "") + "/hubs/app";
        const connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrl, { accessTokenFactory: () => token })
          .withAutomaticReconnect()
          .build();

        connection.on("ReceiveMessage", (msg: MessageResponse) => {
          // Adjust isOwnMessage based on current user
          const adjustedMsg = {
            ...msg,
            isOwnMessage: msg.senderId === user?.userId,
          };
          setMessages((prev) => {
            // Avoid duplicates (we also get the message from our own POST)
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, adjustedMsg];
          });
          // Mark as read if the message is from the other person
          if (msg.senderId !== user?.userId) {
            markAsRead(conversationId).catch(() => {});
          }
          scrollToBottom();
        });

        connection.on("MessagesRead", () => {
          setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
        });

        await connection.start();
        await connection.invoke("JoinConversation", conversationId);
        connectionRef.current = connection;
      } catch {
        // SignalR failed — messages still work via API
      }
    })();

    return () => {
      stopped = true;
      if (connectionRef.current) {
        connectionRef.current.invoke("LeaveConversation", conversationId).catch(() => {});
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, [conversationId, isLoggedIn, user?.userId, scrollToBottom]);

  const handleSend = async (text: string) => {
    setSendError("");
    try {
      const msg = await sendMessage(conversationId, text);
      const adjustedMsg = { ...msg, isOwnMessage: true };
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, adjustedMsg];
      });
      scrollToBottom();
    } catch (err) {
      if (err instanceof Error && err.message === "RATE_LIMITED") {
        setSendError(t("rateLimited"));
      } else {
        setSendError(t("sendError"));
      }
      // Auto-dismiss after 4 seconds
      setTimeout(() => setSendError(""), 4000);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col" style={{ height: "calc(100dvh - 4rem)" }}>
        <div className="flex items-center gap-3 border-b border-border px-2 py-3">
          <div className="size-8 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  if (!isLoggedIn || error || !conversation) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-muted-foreground">{t("loadError")}</p>
        <button onClick={() => router.push("/messages")} className="text-sm text-primary mt-2 underline">
          {t("backToMessages")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col" style={{ height: "calc(100dvh - 4rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-2 py-3 shrink-0">
        <button
          onClick={() => router.push("/messages")}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={t("backToMessages")}
        >
          <ArrowLeft className="size-5" />
        </button>
        <Link href={`/user/${encodeURIComponent(conversation.otherUserDisplayName)}`} className="flex items-center gap-2 hover:opacity-80">
          <UserAvatar
            displayName={conversation.otherUserDisplayName}
            avatarUrl={conversation.otherUserAvatarUrl}
            size="sm"
          />
          <span className="text-sm font-medium">{conversation.otherUserDisplayName}</span>
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t("noConversationsHint")}
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div className="px-3 pb-1">
          <p className="text-xs text-destructive">{sendError}</p>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0">
        <MessageInput onSend={handleSend} />
      </div>
    </div>
  );
}
