"use client";

import { useState, useRef, useCallback } from "react";
import { MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NominatimResult {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

interface LocationSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;

export function LocationSearch({
  value,
  onChange,
  placeholder = "Search city...",
  className,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ city: string; country: string; display: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data: NominatimResult[] = await res.json();

      setResults(
        data.map((r) => {
          const city = r.address.city || r.address.town || r.address.village || r.address.county || "";
          const country = r.address.country || "";
          return {
            city,
            country,
            display: city && country ? `${city}, ${country}` : r.display_name.split(",").slice(0, 2).join(",").trim(),
          };
        })
      );
      setOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  const onInput = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), DEBOUNCE_MS);
  };

  const select = (display: string) => {
    onChange(display);
    setSelected(true);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const clear = () => {
    onChange("");
    setSelected(false);
    setQuery("");
    setResults([]);
  };

  // If parent set a value externally (e.g. from profile load), show it as selected
  if (value && !selected) {
    setSelected(true);
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      {selected && value ? (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1">{value}</span>
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          <Input
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
          />
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(r.display)}
                >
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{r.city}</span>
                  <span className="text-xs text-muted-foreground">{r.country}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
