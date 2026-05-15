"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getUnreadCount } from "@/lib/messages";
import { getNotificationUnreadCount } from "@/lib/notifications";
import { getToken } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";
const POLL_INTERVAL = 30_000;

export function useRealtime() {
  const { isLoggedIn } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const connectionRef = useRef<any>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!isLoggedIn) {
      setMessageCount(0);
      setNotificationCount(0);
      return;
    }
    try {
      const [msgData, notifData] = await Promise.all([
        getUnreadCount(),
        getNotificationUnreadCount(),
      ]);
      setMessageCount(msgData.count);
      setNotificationCount(notifData.count);
    } catch { /* ignore */ }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setMessageCount(0);
      setNotificationCount(0);
      return;
    }

    fetchCounts();

    // Try SignalR connection
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

        connection.on("UnreadCountChanged", (newCount: number) => {
          setMessageCount(newCount);
        });

        connection.on("NotificationCountChanged", (newCount: number) => {
          setNotificationCount(newCount);
        });

        await connection.start();
        connectionRef.current = connection;
      } catch {
        // SignalR failed — fall back to polling
        pollRef.current = setInterval(fetchCounts, POLL_INTERVAL);
      }
    })();

    return () => {
      stopped = true;
      connectionRef.current?.stop();
      connectionRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn, fetchCounts]);

  return {
    messageCount,
    notificationCount,
    setNotificationCount,
    refetch: fetchCounts,
  };
}
