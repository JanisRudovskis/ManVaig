"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getUnreadCount } from "@/lib/messages";
import { getToken } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";
const POLL_INTERVAL = 30_000;

export function useUnreadCount() {
  const { isLoggedIn } = useAuth();
  const [count, setCount] = useState(0);
  const connectionRef = useRef<any>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCount = useCallback(async () => {
    if (!isLoggedIn) { setCount(0); return; }
    try {
      const data = await getUnreadCount();
      setCount(data.count);
    } catch { /* ignore */ }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) { setCount(0); return; }

    fetchCount();

    // Try SignalR connection
    let stopped = false;
    (async () => {
      try {
        const signalR = await import("@microsoft/signalr");
        const token = getToken();
        if (!token || stopped) return;

        const hubUrl = API_URL.replace(/\/$/, "") + "/hubs/chat";
        const connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrl, { accessTokenFactory: () => token })
          .withAutomaticReconnect()
          .build();

        connection.on("UnreadCountChanged", (newCount: number) => {
          setCount(newCount);
        });

        await connection.start();
        connectionRef.current = connection;
      } catch {
        // SignalR failed — fall back to polling
        pollRef.current = setInterval(fetchCount, POLL_INTERVAL);
      }
    })();

    return () => {
      stopped = true;
      connectionRef.current?.stop();
      connectionRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn, fetchCount]);

  return { count, refetch: fetchCount };
}
