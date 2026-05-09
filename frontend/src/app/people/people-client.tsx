"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPublicUsers, type PublicUserCard as PublicUserCardData } from "@/lib/users";
import {
  PublicUserCard,
  PublicUserCardSkeleton,
} from "@/components/public-user-card";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function PeopleClient() {
  const t = useTranslations("people");
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQ = searchParams.get("q") ?? "";

  const [input, setInput] = useState(initialQ);
  const debouncedInput = useDebouncedValue(input, DEBOUNCE_MS);
  const [activeQuery, setActiveQuery] = useState(initialQ);
  const [retryCounter, setRetryCounter] = useState(0);

  const [users, setUsers] = useState<PublicUserCardData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedQuery = activeQuery.trim();
  const queryReady = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const writeUrl = useCallback(
    (nextQ: string) => {
      const params = new URLSearchParams();
      const trimmed = nextQ.trim();
      if (trimmed.length >= MIN_QUERY_LENGTH) params.set("q", trimmed);
      const qs = params.toString();
      router.replace(qs ? `/people?${qs}` : "/people", { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    setActiveQuery(debouncedInput);
  }, [debouncedInput]);

  useEffect(() => {
    writeUrl(debouncedInput);
  }, [debouncedInput, writeUrl]);

  useEffect(() => {
    setUsers([]);
    setTotalCount(0);
    setPage(1);
    setError("");
  }, [activeQuery]);

  useEffect(() => {
    if (!queryReady) {
      setLoading(false);
      setLoadingMore(false);
      abortRef.current?.abort();
      return;
    }

    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError("");

    (async () => {
      try {
        const data = await fetchPublicUsers({
          page: 1,
          pageSize: PAGE_SIZE,
          q: trimmedQuery,
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) return;
        setUsers(data.users);
        setTotalCount(data.totalCount);
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        if (gen !== genRef.current) return;
        setError(t("errorLoadFailed"));
      } finally {
        if (gen === genRef.current) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [trimmedQuery, queryReady, retryCounter, t]);

  const handleLoadMore = useCallback(async () => {
    if (!queryReady || loadingMore) return;
    const nextPage = page + 1;
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingMore(true);
    try {
      const data = await fetchPublicUsers({
        page: nextPage,
        pageSize: PAGE_SIZE,
        q: trimmedQuery,
        signal: ctrl.signal,
      });
      if (gen !== genRef.current) return;
      setUsers((prev) => [...prev, ...data.users]);
      setTotalCount(data.totalCount);
      setPage(nextPage);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      if (gen !== genRef.current) return;
      setError(t("errorLoadFailed"));
    } finally {
      if (gen === genRef.current) setLoadingMore(false);
    }
  }, [queryReady, loadingMore, page, trimmedQuery, t]);

  const fireImmediate = useCallback(
    (value: string) => {
      setInput(value);
      setActiveQuery(value);
      writeUrl(value);
    },
    [writeUrl]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (input.trim().length >= MIN_QUERY_LENGTH) {
          fireImmediate(input);
        }
      }
    },
    [input, fireImmediate]
  );

  const handleClear = useCallback(() => {
    fireImmediate("");
  }, [fireImmediate]);

  const handleRetry = useCallback(() => {
    setError("");
    setRetryCounter((c) => c + 1);
  }, []);

  const renderedCount = users.length;
  const hasMore = renderedCount < totalCount;
  const showInitialEmpty = !queryReady;
  const showResults = queryReady && !loading && !error && renderedCount > 0;
  const showNoResults =
    queryReady && !loading && !error && renderedCount === 0;

  return (
    <main className="mx-auto max-w-[600px] px-4 py-6 md:px-6 md:py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        {t("title")}
      </h1>

      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          autoComplete="off"
          spellCheck={false}
          className="h-11 pl-9 pr-11"
        />
        {input.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("clearSearch")}
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {loading
          ? t("loading")
          : error
            ? error
            : queryReady && totalCount > 0
              ? t("liveCount", { count: totalCount })
              : ""}
      </div>

      {showInitialEmpty && !error && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Users
            className="size-12 text-muted-foreground/50"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("emptyInitial")}</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("emptyInitialDescription")}
            </p>
          </div>
        </div>
      )}

      {queryReady && loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PublicUserCardSkeleton key={i} />
          ))}
        </div>
      )}

      {queryReady && !loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
            {t("retry")}
          </Button>
        </div>
      )}

      {showNoResults && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Users
            className="size-12 text-muted-foreground/50"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold">
            {t("noResults", { q: trimmedQuery })}
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("noResultsDescription")}
          </p>
        </div>
      )}

      {showResults && (
        <>
          <div className="flex flex-col gap-3">
            {users.map((user) => (
              <PublicUserCard key={user.displayName} user={user} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex items-center justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="min-h-[44px]"
              >
                {loadingMore ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    {t("loading")}
                  </>
                ) : (
                  t("loadMore")
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
