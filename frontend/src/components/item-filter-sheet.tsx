"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  type ItemFilters,
  type ListingType,
  type SortOption,
} from "@/lib/search-filters";

interface ItemFilterSheetProps {
  filters: ItemFilters;
  onChange: (filters: ItemFilters) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label for the trigger button */
  triggerLabel: string;
  /** Number to show in the badge (0 = no badge) */
  badgeCount: number;
}

const CATEGORIES = Array.from({ length: 12 }, (_, i) => i + 1);

const CONDITIONS: { value: number; key: string }[] = [
  { value: 0, key: "condNew" },
  { value: 1, key: "condLikeNew" },
  { value: 2, key: "condGood" },
  { value: 3, key: "condFair" },
  { value: 4, key: "condPoor" },
];

const LISTING_TYPES: { value: ListingType; key: string }[] = [
  { value: "fixed", key: "typeFixed" },
  { value: "offers", key: "typeOffers" },
  { value: "timed", key: "typeTimed" },
];

const SORT_OPTIONS: { value: SortOption; key: string }[] = [
  { value: "newest", key: "sortNewest" },
  { value: "oldest", key: "sortOldest" },
  { value: "priceAsc", key: "sortPriceAsc" },
  { value: "priceDesc", key: "sortPriceDesc" },
];

const pillBase =
  "rounded-full border px-3 py-2 text-sm transition-colors min-h-[44px] inline-flex items-center";
const pillActive =
  "border-foreground bg-foreground text-background";
const pillInactive =
  "border-border bg-background text-foreground hover:bg-accent/50";

const triggerClass =
  "flex items-center gap-2 self-start rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent/50";

/* ── Trigger button (shared between mobile & desktop) ── */

function FilterTrigger({
  label,
  badgeCount,
  onClick,
}: {
  label: string;
  badgeCount: number;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={triggerClass}>
      <SlidersHorizontal className="size-4" aria-hidden="true" />
      <span>{label}</span>
      {badgeCount > 0 && (
        <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background">
          {badgeCount}
        </span>
      )}
    </button>
  );
}

/* ── Shared filter body ── */

function FilterBody({
  draft,
  setDraft,
}: {
  draft: ItemFilters;
  setDraft: React.Dispatch<React.SetStateAction<ItemFilters>>;
}) {
  const tc = useTranslations("categories");
  const tf = useTranslations("search.filters");

  const toggleType = (type: ListingType) => {
    setDraft((d) => ({
      ...d,
      types: d.types.includes(type)
        ? d.types.filter((t) => t !== type)
        : [...d.types, type],
    }));
  };

  const toggleCondition = (cond: number) => {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.includes(cond)
        ? d.conditions.filter((c) => c !== cond)
        : [...d.conditions, cond],
    }));
  };

  return (
    <div className="space-y-5">
      {/* Category */}
      <section>
        <h3 className="mb-2 text-sm font-medium">{tf("category")}</h3>
        <select
          value={draft.categoryId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setDraft((d) => ({ ...d, categoryId: v === "" ? null : parseInt(v, 10) }));
          }}
          className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 min-h-[44px] [&>option]:bg-background [&>option]:text-foreground"
          aria-label={tf("category")}
        >
          <option value="">{tf("anyCategory")}</option>
          {CATEGORIES.map((id) => (
            <option key={id} value={id}>
              {tc(String(id))}
            </option>
          ))}
        </select>
      </section>

      {/* Price range */}
      <section>
        <h3 className="mb-2 text-sm font-medium">{tf("priceRange")}</h3>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Input
              type="number"
              inputMode="numeric"
              placeholder={tf("priceMin")}
              value={draft.priceMin ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({
                  ...d,
                  priceMin: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                }));
              }}
              className="h-11 flex-1 pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              &euro;
            </span>
          </div>
          <span className="text-muted-foreground">—</span>
          <div className="relative flex-1">
            <Input
              type="number"
              inputMode="numeric"
              placeholder={tf("priceMax")}
              value={draft.priceMax ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({
                  ...d,
                  priceMax: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                }));
              }}
              className="h-11 flex-1 pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              &euro;
            </span>
          </div>
        </div>
        {draft.priceMin != null &&
          draft.priceMax != null &&
          draft.priceMin > draft.priceMax && (
            <p className="mt-1 text-xs text-destructive">{tf("priceRangeError")}</p>
          )}
      </section>

      {/* Listing type */}
      <section>
        <h3 className="mb-2 text-sm font-medium">{tf("listingType")}</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label={tf("listingType")}>
          {LISTING_TYPES.map((lt) => (
            <button
              key={lt.value}
              type="button"
              aria-pressed={draft.types.includes(lt.value)}
              onClick={() => toggleType(lt.value)}
              className={`${pillBase} ${
                draft.types.includes(lt.value) ? pillActive : pillInactive
              }`}
            >
              {tf(lt.key)}
            </button>
          ))}
        </div>
      </section>

      {/* Condition */}
      <section>
        <h3 className="mb-2 text-sm font-medium">{tf("condition")}</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label={tf("condition")}>
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={draft.conditions.includes(c.value)}
              onClick={() => toggleCondition(c.value)}
              className={`${pillBase} ${
                draft.conditions.includes(c.value) ? pillActive : pillInactive
              }`}
            >
              {tf(c.key)}
            </button>
          ))}
        </div>
      </section>

      {/* Sort */}
      <section>
        <h3 className="mb-2 text-sm font-medium">{tf("sort")}</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tf("sort")}>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={draft.sort === s.value}
              onClick={() => setDraft((d) => ({ ...d, sort: s.value }))}
              className={`${pillBase} ${
                draft.sort === s.value ? pillActive : pillInactive
              }`}
            >
              {tf(s.key)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Main export: responsive container ── */

export function ItemFilterSheet({
  filters,
  onChange,
  open,
  onOpenChange,
  triggerLabel,
  badgeCount,
}: ItemFilterSheetProps) {
  const tf = useTranslations("search.filters");
  const isMobile = useIsMobile();

  // Local draft state — only applied on "Show results"
  const [draft, setDraft] = useState<ItemFilters>(filters);

  const syncDraftAndOpen = (next: boolean) => {
    if (next) setDraft(filters);
    onOpenChange(next);
  };

  const handleApply = () => {
    onChange(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
  };

  const draftActiveCount = activeFilterCount(draft);

  const header = (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-medium">{tf("title")}</h3>
      <div className="flex items-center gap-2">
        {draftActiveCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
          >
            {tf("resetAll")}
          </button>
        )}
      </div>
    </div>
  );

  const footer = (
    <Button
      type="button"
      onClick={handleApply}
      className="w-full min-h-[44px]"
    >
      {tf("showResults")}
    </Button>
  );

  /* ── Mobile: bottom sheet ── */
  if (isMobile) {
    return (
      <>
        <FilterTrigger
          label={triggerLabel}
          badgeCount={badgeCount}
          onClick={() => syncDraftAndOpen(true)}
        />
        <Sheet open={open} onOpenChange={syncDraftAndOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85vh] rounded-t-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <SheetHeader className="flex-row items-center justify-between border-b pb-3">
              <SheetTitle>{tf("title")}</SheetTitle>
              <div className="flex items-center gap-2">
                {draftActiveCount > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
                  >
                    {tf("resetAll")}
                  </button>
                )}
                <SheetClose
                  render={
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      aria-label="Close"
                    />
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </SheetClose>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <FilterBody draft={draft} setDraft={setDraft} />
            </div>

            <SheetFooter className="border-t pt-3">
              {footer}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  /* ── Desktop: popover ── */
  return (
    <Popover open={open} onOpenChange={syncDraftAndOpen}>
      <PopoverTrigger
        render={
          <FilterTrigger
            label={triggerLabel}
            badgeCount={badgeCount}
          />
        }
      />
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[420px] max-h-[80vh] flex flex-col !p-0"
      >
        {/* Header */}
        <div className="border-b px-4 py-3">
          {header}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <FilterBody draft={draft} setDraft={setDraft} />
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          {footer}
        </div>
      </PopoverContent>
    </Popover>
  );
}
