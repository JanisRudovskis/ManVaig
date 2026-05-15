"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPublicBids } from "@/lib/items";
import type { BidListResponse } from "@/lib/items";

const INITIAL_LIMIT = 5;
const EXPANDED_LIMIT = 200;
const POLL_INTERVAL_MS = 10_000;
const RETRY_INTERVAL_MS = 3_000;
const STALE_WARNING_MS = 20_000;
const STALE_DANGER_MS = 45_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export { INITIAL_LIMIT };

interface UseOffersBidsOptions {
  itemId: string;
  onNewExternalBid?: (topBid: { amount: number; id: string }) => void;
  /** When true, sound always starts OFF (tab page — AudioContext locked until user gesture) */
  soundDefaultOff?: boolean;
}

export function useOffersBids({ itemId, onNewExternalBid, soundDefaultOff }: UseOffersBidsOptions) {
  const [data, setData] = useState<BidListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [topBidFlash, setTopBidFlash] = useState(false);
  const [newBidIds, setNewBidIds] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (soundDefaultOff) return false;
    if (typeof window === "undefined") return true;
    return localStorage.getItem("manvaig_bid_sound") !== "off";
  });

  // Reliability state
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const inputFocusedRef = useRef(false);
  const prevHighestRef = useRef<{ amount: number; id: string } | null>(null);
  const prevBidMapRef = useRef<Map<string, number>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const onNewExternalBidRef = useRef(onNewExternalBid);
  onNewExternalBidRef.current = onNewExternalBid;
  const consecutiveFailuresRef = useRef(0);

  const currentLimit = expanded ? EXPANDED_LIMIT : INITIAL_LIMIT;

  // --- Ding sound via Web Audio API ---

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;

    fetch("/sounds/bid-ding.wav")
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => { audioBufferRef.current = decoded; })
      .catch(() => {});

    if (ctx.state === "running") {
      setAudioUnlocked(true);
    } else {
      const unlock = () => {
        ctx.resume().then(() => setAudioUnlocked(true)).catch(() => {});
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
      };
      document.addEventListener("click", unlock);
      document.addEventListener("keydown", unlock);

      return () => {
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
        ctx.close().catch(() => {});
      };
    }

    return () => { ctx.close().catch(() => {}); };
  }, []);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const playDing = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const buffer = audioBufferRef.current;
      if (!ctx || !buffer) return;
      if (ctx.state === "suspended") ctx.resume();
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      source.buffer = buffer;
      source.connect(gain).connect(ctx.destination);
      source.start(0);
    } catch { /* ignore */ }
  }, []);

  const handleNewData = useCallback((newData: BidListResponse, isPolling: boolean) => {
    const topBid = newData.bids[0];
    const prev = prevHighestRef.current;

    if (isPolling && prev && topBid && (topBid.id !== prev.id || topBid.amount !== prev.amount) && !topBid.isOwnBid) {
      playDing();
      setTopBidFlash(true);
      setTimeout(() => setTopBidFlash(false), 1500);
      onNewExternalBidRef.current?.({ amount: topBid.amount, id: topBid.id });
    }

    if (isPolling && prevBidMapRef.current.size > 0) {
      const incoming = new Set<string>();
      for (const bid of newData.bids) {
        const prevAmount = prevBidMapRef.current.get(bid.id);
        if (prevAmount === undefined || prevAmount !== bid.amount) {
          incoming.add(bid.id);
        }
      }
      if (incoming.size > 0) {
        setNewBidIds(incoming);
        setTimeout(() => setNewBidIds(new Set()), 600);
      }
    }

    prevBidMapRef.current = new Map(newData.bids.map((b) => [b.id, b.amount]));

    if (topBid) {
      prevHighestRef.current = { amount: topBid.amount, id: topBid.id };
    }

    setLastUpdatedAt(Date.now());
    setConsecutiveFailures(0);
    consecutiveFailuresRef.current = 0;
    setConnectionLost(false);
    setData(newData);
  }, [playDing]);

  // --- Data loading with retry logic ---

  const loadBids = useCallback((limit: number, isPolling = false) => {
    if (!isPolling) setLoading(true);
    fetchPublicBids(itemId, limit)
      .then((d) => handleNewData(d, isPolling))
      .catch(() => {
        if (isPolling) {
          const fails = consecutiveFailuresRef.current + 1;
          consecutiveFailuresRef.current = fails;
          setConsecutiveFailures(fails);
          if (fails >= MAX_CONSECUTIVE_FAILURES) {
            setConnectionLost(true);
          }
        } else {
          setError("error_bids_fetch_failed");
        }
      })
      .finally(() => { if (!isPolling) setLoading(false); });
  }, [itemId, handleNewData]);

  // Initial load
  useEffect(() => {
    loadBids(currentLimit);
  }, [currentLimit, loadBids]);

  // --- Polling with retry ---
  useEffect(() => {
    const getInterval = () =>
      consecutiveFailuresRef.current > 0 ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS;

    let timer: ReturnType<typeof setTimeout>;

    const poll = () => {
      if (!inputFocusedRef.current) {
        loadBids(currentLimit, true);
      }
      timer = setTimeout(poll, getInterval());
    };

    timer = setTimeout(poll, getInterval());
    return () => clearTimeout(timer);
  }, [currentLimit, loadBids]);

  // --- Immediate refresh on tab focus ---
  useEffect(() => {
    const handleFocus = () => {
      loadBids(currentLimit, true);
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) handleFocus();
    });
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentLimit, loadBids]);

  const hasMore = data != null && data.totalBids > data.bids.length;

  return {
    data,
    loading,
    error,
    expanded,
    topBidFlash,
    newBidIds,
    soundEnabled,
    lastUpdatedAt,
    consecutiveFailures,
    connectionLost,
    manualRefreshing,
    staleWarningMs: STALE_WARNING_MS,
    staleDangerMs: STALE_DANGER_MS,
    manualRefresh: () => {
      setManualRefreshing(true);
      fetchPublicBids(itemId, currentLimit)
        .then((d) => {
          handleNewData(d, false);
          setTimeout(() => setManualRefreshing(false), 300);
        })
        .catch(() => {
          setManualRefreshing(false);
          setError("error_bids_fetch_failed");
        });
    },
    toggleSound: () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().then(() => setAudioUnlocked(true)).catch(() => {});
      setSoundEnabled((v) => {
        const next = !v;
        if (!soundDefaultOff) {
          localStorage.setItem("manvaig_bid_sound", next ? "on" : "off");
        }
        return next;
      });
    },
    inputFocusedRef,
    currentLimit,
    hasMore,
    setExpanded,
    setError,
    loadBids,
  };
}
