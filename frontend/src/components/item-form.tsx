"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Trash2,
  DollarSign,
  MessageCircle,
  TrendingUp,
  Clock,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { lv } from "date-fns/locale/lv";
import { enUS } from "date-fns/locale/en-US";
import { ImageManager } from "@/components/image-manager";
import type { FormImage } from "@/components/image-manager";
import {
  createItem,
  updateItem,
  deleteItem,
  fetchCategories,
  uploadItemImages,
  reorderItemImages,
  deleteItemImage,
  fetchBids,
  assignNextWinner,
  PricingType,
  Condition,
  ItemVisibility,
} from "@/lib/items";
import type { ItemResponse, ItemImage, CategoryDto, CreateItemData, UpdateItemData, BidListResponse } from "@/lib/items";
import { LocationSearch } from "@/components/location-search";

// === Types ===

interface ItemFormProps {
  mode: "add" | "edit";
  item?: ItemResponse | null;
  stallId?: string;
  userLocation?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

// === Component ===

export function ItemForm({ mode, item, stallId, userLocation, onClose, onSaved, onDeleted }: ItemFormProps) {
  const t = useTranslations("itemForm");
  const locale = useLocale();

  // Form state
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? 0);
  const [condition, setCondition] = useState(item?.condition ?? Condition.Used);
  const [pricingType, setPricingType] = useState(item?.pricingType ?? PricingType.Fixed);
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [minBidPrice, setMinBidPrice] = useState(item?.minBidPrice?.toString() ?? "");
  const [bidStep, setBidStep] = useState(item?.bidStep?.toString() ?? "");
  const [auctionEndDate, setAuctionEndDate] = useState<Date | undefined>(() => {
    if (!item?.auctionEnd) return undefined;
    return new Date(item.auctionEnd);
  });
  const [auctionEndTime, setAuctionEndTime] = useState(() => {
    if (!item?.auctionEnd) return "23:59";
    const d = new Date(item.auctionEnd);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dateFnsLocale = locale === "lv" ? lv : enUS;
  const auctionEndIso = (() => {
    if (!auctionEndDate || !auctionEndTime.match(/^\d{2}:\d{2}$/)) return "";
    const y = auctionEndDate.getFullYear();
    const m = String(auctionEndDate.getMonth() + 1).padStart(2, "0");
    const d = String(auctionEndDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}T${auctionEndTime}`;
  })();
  const [visibility, setVisibility] = useState(item?.visibility ?? ItemVisibility.Public);
  const [location, setLocation] = useState(item?.location ?? userLocation ?? "");
  const [canShip, setCanShip] = useState(item?.canShip ?? false);
  const [allowGuestOffers, setAllowGuestOffers] = useState(item?.allowGuestOffers ?? false);
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  // Image state
  const [images, setImages] = useState<FormImage[]>(() => {
    if (item?.images?.length) {
      return item.images.map((img) => ({
        id: img.id,
        url: img.url,
        isPrimary: img.isPrimary,
      }));
    }
    return [];
  });
  const [uploading, setUploading] = useState(false);

  // UI state
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tagInputRef = useRef<HTMLInputElement>(null);

  // Bid history (auction items only, edit mode)
  const [bidData, setBidData] = useState<BidListResponse | null>(null);
  const [bidLoading, setBidLoading] = useState(false);

  // Load categories
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Load bids for auction items in edit mode
  useEffect(() => {
    if (mode === "edit" && item?.pricingType === PricingType.Auction) {
      setBidLoading(true);
      fetchBids(item.id).then(setBidData).catch(() => {}).finally(() => setBidLoading(false));
    }
  }, [mode, item]);

  // === Tags ===

  const addTag = (value: string) => {
    const normalized = value.trim().toLowerCase().slice(0, 30);
    if (!normalized || tags.length >= 10 || tags.includes(normalized)) return;
    setTags([...tags, normalized]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  // === Validation helpers ===

  const hasMoreThan2Decimals = (val: string) => {
    const parts = val.split(".");
    return parts.length === 2 && parts[1].length > 2;
  };

  // === Validation ===

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    // Images: at least 1 required
    if (images.length === 0) errs.images = t("errorImagesRequired");

    // Title: required, 3-100 chars
    const trimmedTitle = title.trim();
    if (!trimmedTitle) errs.title = t("errorTitleRequired");
    else if (trimmedTitle.length < 3 || trimmedTitle.length > 100) errs.title = t("errorTitleLength");

    // Description: optional, max 2000
    if (description.length > 2000) errs.description = t("errorDescriptionLength");

    // Category: required
    if (!categoryId) errs.category = t("errorCategoryRequired");

    // Tags: each max 30 chars
    if (tags.some((tag) => tag.length > 30)) errs.tags = t("errorTagLength");

    // Pricing type specific
    if (pricingType === PricingType.Fixed || pricingType === PricingType.FixedOffers) {
      const priceNum = parseFloat(price);
      if (!price || priceNum <= 0) errs.price = t("errorPriceRequired");
      else if (hasMoreThan2Decimals(price)) errs.price = t("errorPriceDecimals");

      // FixedOffers: minOfferPrice optional but must be <= price
      if (pricingType === PricingType.FixedOffers && minBidPrice) {
        const minNum = parseFloat(minBidPrice);
        if (minNum > priceNum) errs.minBidPrice = t("errorMinOfferExceedsPrice");
      }
    }

    if (pricingType === PricingType.Bidding) {
      // MinBidPrice optional but must be > 0 if set
      if (minBidPrice && parseFloat(minBidPrice) <= 0) errs.minBidPrice = t("errorMinBidPositive");
      // BidStep optional but must be > 0 if set
      if (bidStep && parseFloat(bidStep) <= 0) errs.bidStep = t("errorBidStepPositive");
    }

    if (pricingType === PricingType.Auction) {
      // Starting price required for auction
      if (!minBidPrice || parseFloat(minBidPrice) <= 0) errs.minBidPrice = t("errorAuctionStartRequired");
      // BidStep optional but must be > 0 if set
      if (bidStep && parseFloat(bidStep) <= 0) errs.bidStep = t("errorBidStepPositive");
      // AuctionEnd required, min 1h in future
      if (!auctionEndIso) errs.auctionEnd = t("errorAuctionEndRequired");
      else {
        const endTime = new Date(auctionEndIso).getTime();
        const oneHourFromNow = Date.now() + 60 * 60 * 1000;
        if (endTime <= oneHourFromNow) errs.auctionEnd = t("errorAuctionEndMinDuration");
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // === Save ===

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      let savedItemId: string;

      if (mode === "add") {
        const data: CreateItemData = {
          stallId: stallId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          condition,
          pricingType,
          price: price ? parseFloat(price) : null,
          minBidPrice: minBidPrice ? parseFloat(minBidPrice) : null,
          bidStep: bidStep ? parseFloat(bidStep) : null,
          auctionEnd: auctionEndIso || null,
          visibility,
          location: location || undefined,
          canShip,
          allowGuestOffers,
          tags: tags.length > 0 ? tags : undefined,
        };
        const created = await createItem(data);
        savedItemId = created.id;
      } else if (item) {
        const data: UpdateItemData = {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          condition,
          pricingType,
          price: price ? parseFloat(price) : null,
          minBidPrice: minBidPrice ? parseFloat(minBidPrice) : null,
          bidStep: bidStep ? parseFloat(bidStep) : null,
          auctionEnd: auctionEndIso || null,
          visibility,
          location: location || "",
          canShip,
          allowGuestOffers,
          tags,
          clearPricingFields: true,
        };
        await updateItem(item.id, data);
        savedItemId = item.id;
      } else {
        return;
      }

      // Upload new images (files that haven't been uploaded yet)
      const newFiles = images.filter((img) => img.file).map((img) => img.file!);
      if (newFiles.length > 0) {
        setUploading(true);
        await uploadItemImages(savedItemId, newFiles);
      }

      // Delete removed images (images that existed on server but were removed in form)
      if (mode === "edit" && item?.images) {
        const currentIds = new Set(images.filter((img) => !img.file).map((img) => img.id));
        const deletedImages = item.images.filter((img) => !currentIds.has(img.id));
        for (const img of deletedImages) {
          await deleteItemImage(savedItemId, img.id);
        }
      }

      // Reorder if needed (send current order of server-side images)
      const serverImages = images.filter((img) => !img.file);
      if (mode === "edit" && serverImages.length > 1) {
        await reorderItemImages(savedItemId, serverImages.map((img) => img.id));
      }
      onSaved();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      const errorKey = `apiError_${code}`;
      const translated = t.has(errorKey) ? t(errorKey) : t("errorSaveFailed");
      setErrors({ form: translated });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // === Delete ===

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm(t("deleteConfirm"))) return;

    setSaving(true);
    try {
      await deleteItem(item.id);
      onDeleted?.();
    } catch {
      setErrors({ form: t("errorDeleteFailed") });
    } finally {
      setSaving(false);
    }
  };

  // === Pricing type config ===

  const pricingTypes = [
    { type: PricingType.Fixed, key: "fixed", icon: DollarSign, color: "border-blue-500 bg-blue-500/5" },
    { type: PricingType.FixedOffers, key: "offers", icon: MessageCircle, color: "border-purple-500 bg-purple-500/5" },
    { type: PricingType.Bidding, key: "bidding", icon: TrendingUp, color: "border-orange-500 bg-orange-500/5" },
    { type: PricingType.Auction, key: "auction", icon: Clock, color: "border-orange-500 bg-orange-500/5" },
  ];

  const conditionOptions = [
    { value: Condition.New, key: "condNew" },
    { value: Condition.Used, key: "condUsed" },
    { value: Condition.Worn, key: "condWorn" },
  ];

  const visibilityOptions = [
    { value: ItemVisibility.Public, key: "visPublic" },
    { value: ItemVisibility.RegisteredOnly, key: "visRegistered" },
    { value: ItemVisibility.LinkOnly, key: "visLinkOnly" },
    { value: ItemVisibility.Private, key: "visPrivate" },
  ];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-2 z-51 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[85vh] md:w-[640px] md:-translate-x-1/2 md:-translate-y-1/2">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">
            {mode === "edit" ? t("titleEdit") : t("titleAdd")}
          </h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* === Section: Images === */}
          <div className="mb-7">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionImages")} *
            </div>
            <ImageManager
              images={images}
              onChange={setImages}
              error={errors.images}
            />
          </div>

          {/* === Section: Basic Info === */}
          <div className="mb-7">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionBasicInfo")}
            </div>

            {/* Title */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldTitle")} *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder={t("fieldTitlePlaceholder")}
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.title ? (
                  <p className="text-xs text-destructive">{errors.title}</p>
                ) : <span />}
                <span className={`text-xs ${title.length > 90 ? "text-orange-400" : "text-muted-foreground"}`}>
                  {t("charCount", { count: title.length, max: 100 })}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldDescription")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder={t("fieldDescriptionPlaceholder")}
                rows={3}
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.description ? (
                  <p className="text-xs text-destructive">{errors.description}</p>
                ) : <span />}
                <span className={`text-xs ${description.length > 1900 ? "text-orange-400" : "text-muted-foreground"}`}>
                  {t("charCount", { count: description.length, max: 2000 })}
                </span>
              </div>
            </div>

            {/* Category */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldCategory")} *</Label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(parseInt(e.target.value))}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value={0} className="bg-background text-foreground">{t("categoryPlaceholder")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-background text-foreground">
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category}</p>}
            </div>

            {/* Location */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldLocation")}</Label>
              <LocationSearch
                value={location}
                onChange={setLocation}
                placeholder={t("locationPlaceholder")}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("locationHint")}</p>
            </div>

            {/* Condition */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldCondition")}</Label>
              <div className="flex w-fit gap-0 rounded-md bg-muted p-0.5">
                {conditionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCondition(opt.value)}
                    className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
                      condition === opt.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(opt.key)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* === Section: Pricing Type === */}
          <div className="mb-7">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionPricing")}
            </div>

            {/* Type cards 2x2 */}
            <div className="grid grid-cols-2 gap-2">
              {pricingTypes.map((pt) => (
                <button
                  key={pt.type}
                  onClick={() => setPricingType(pt.type)}
                  className={`min-h-[80px] rounded-lg border-2 p-3 text-left transition-all ${
                    pricingType === pt.type
                      ? pt.color
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                    <pt.icon className={`size-4 ${
                      pt.key === "fixed" ? "text-blue-500" :
                      pt.key === "offers" ? "text-purple-500" :
                      "text-orange-500"
                    }`} />
                    {t(`pricing_${pt.key}`)}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t(`pricing_${pt.key}_desc`)}
                  </p>
                </button>
              ))}
            </div>

            {/* Dynamic pricing fields */}
            <div className="mt-4">
              {/* Fixed / FixedOffers → Price */}
              {(pricingType === PricingType.Fixed || pricingType === PricingType.FixedOffers) && (
                <div className="mb-4">
                  <Label className="mb-1.5">
                    {pricingType === PricingType.FixedOffers ? t("fieldListedPrice") : t("fieldPrice")} *
                  </Label>
                  <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === "") setPrice(e.target.value); }}
                      placeholder="0.00"
                      className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                    />
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">
                      €
                    </span>
                  </div>
                  {pricingType === PricingType.FixedOffers && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("offersHint")}</p>
                  )}
                  {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price}</p>}
                </div>
              )}

              {/* FixedOffers → MinOfferPrice */}
              {pricingType === PricingType.FixedOffers && (
                <div className="mb-4">
                  <Label className="mb-1.5">{t("fieldMinPrice")}</Label>
                  <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={minBidPrice}
                      onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === "") setMinBidPrice(e.target.value); }}
                      placeholder="0.00"
                      className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                    />
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">
                      €
                    </span>
                  </div>
                  {errors.minBidPrice && <p className="mt-1 text-xs text-destructive">{errors.minBidPrice}</p>}
                </div>
              )}

              {/* Bidding → MinBidPrice */}
              {pricingType === PricingType.Bidding && (
                <div className="mb-4">
                  <Label className="mb-1.5">{t("fieldMinPrice")}</Label>
                  <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={minBidPrice}
                      onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === "") setMinBidPrice(e.target.value); }}
                      placeholder="0.00"
                      className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                    />
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">
                      €
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t("biddingHint")}</p>
                  {errors.minBidPrice && <p className="mt-1 text-xs text-destructive">{errors.minBidPrice}</p>}
                </div>
              )}

              {/* Auction → StartPrice, BidStep, EndDate */}
              {pricingType === PricingType.Auction && (
                <>
                  <div className="mb-4">
                    <Label className="mb-1.5">{t("fieldStartPrice")} *</Label>
                    <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={minBidPrice}
                        onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === "") setMinBidPrice(e.target.value); }}
                        placeholder="0.00"
                        className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                      />
                      <span className="flex items-center pr-3 text-sm text-muted-foreground">
                        €
                      </span>
                    </div>
                    {errors.minBidPrice && <p className="mt-1 text-xs text-destructive">{errors.minBidPrice}</p>}
                  </div>
                  <div className="mb-4">
                    <Label className="mb-1.5">{t("fieldBidStep")}</Label>
                    <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bidStep}
                        onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === "") setBidStep(e.target.value); }}
                        placeholder="10.00"
                        className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                      />
                      <span className="flex items-center pr-3 text-sm text-muted-foreground">
                        €
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("bidStepHint")}</p>
                    {errors.bidStep && <p className="mt-1 text-xs text-destructive">{errors.bidStep}</p>}
                  </div>
                  <div className="mb-4">
                    <Label className="mb-1.5">{t("fieldEndDate")} *</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarOpen(!calendarOpen)}
                        className={cn(
                          "inline-flex w-[160px] items-center gap-2 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25",
                          auctionEndDate ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="size-4" />
                        {auctionEndDate
                          ? format(auctionEndDate, "dd.MM.yyyy", { locale: dateFnsLocale })
                          : "DD.MM.YYYY"}
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={auctionEndTime}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^\d:]/g, "");
                          if (v.length === 2 && !v.includes(":") && auctionEndTime.length < v.length) v += ":";
                          if (v.length <= 5) setAuctionEndTime(v);
                        }}
                        onBlur={() => {
                          const m = auctionEndTime.match(/^(\d{1,2}):?(\d{0,2})$/);
                          if (m) {
                            const h = Math.min(23, parseInt(m[1] || "0"));
                            const min = Math.min(59, parseInt(m[2] || "0"));
                            setAuctionEndTime(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
                          }
                        }}
                        placeholder="23:59"
                        className="w-[80px] rounded-md border border-border bg-input px-3 py-2 text-center text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                      />
                    </div>
                    {calendarOpen && (
                      <div className="mt-2 w-fit rounded-md border border-border bg-popover shadow-md">
                        <Calendar
                          mode="single"
                          selected={auctionEndDate}
                          onSelect={(day) => {
                            setAuctionEndDate(day);
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                          locale={dateFnsLocale}
                        />
                      </div>
                    )}
                    {errors.auctionEnd && <p className="mt-1 text-xs text-destructive">{errors.auctionEnd}</p>}
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-300">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>{t("antiSniperNote")}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* === Section: Tags === */}
          <div className="mb-7">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionTags")}
            </div>
            <div
              className="flex min-h-[40px] cursor-text flex-wrap items-center gap-1.5 rounded-md border border-border bg-input px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? t("tagPlaceholder") : ""}
                className="min-w-[100px] flex-1 border-0 bg-transparent text-xs text-foreground outline-none"
              />
            </div>
            <div className="mt-1 flex items-center justify-between">
              {errors.tags ? (
                <p className="text-xs text-destructive">{errors.tags}</p>
              ) : <span />}
              <span className="text-xs text-muted-foreground">
                {tags.length} / 10 {t("tagsCount")}
              </span>
            </div>
          </div>

          {/* === Section: Visibility & Options === */}
          <div className="mb-7">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionVisibility")}
            </div>

            {/* Visibility dropdown */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldVisibility")}</Label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(parseInt(e.target.value))}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 [&>option]:bg-background [&>option]:text-foreground"
              >
                {visibilityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                    {t(opt.key)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{t("visibilityHint")}</p>
            </div>

            {/* Guest offers toggle */}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{t("guestOffers")}</p>
                <p className="text-xs text-muted-foreground">{t("guestOffersHint")}</p>
              </div>
              <Switch checked={allowGuestOffers} onCheckedChange={setAllowGuestOffers} />
            </div>

            {/* Can ship toggle */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{t("canShip")}</p>
                <p className="text-xs text-muted-foreground">{t("canShipHint")}</p>
              </div>
              <Switch checked={canShip} onCheckedChange={setCanShip} />
            </div>
          </div>

          {/* === Bid History (auction items, edit mode only) === */}
          {mode === "edit" && item?.pricingType === PricingType.Auction && (
            <div className="border-t border-border pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("bidsTitle")} ({bidData?.totalBids ?? 0})
              </p>
              {bidLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("loadingBids")}
                </div>
              ) : !bidData || bidData.bids.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("noBids")}</p>
              ) : (
                <div className="space-y-1">
                  {bidData.bids.map((bid) => (
                    <div
                      key={bid.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                        bid.isWinner && bidData.auctionEnded
                          ? "border-l-4 border-emerald-500 bg-emerald-500/10"
                          : "bg-muted/30"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {bid.bidderName ?? bid.bidderLabel}
                          </span>
                          {bid.isWinner && bidData.auctionEnded && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                              {t("winner")}
                            </span>
                          )}
                          {bid.status === "Expired" && (
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                              {t("expired")}
                            </span>
                          )}
                        </div>
                        {bid.bidderContact && bidData.auctionEnded && bid.isWinner && (
                          <p className="text-xs text-muted-foreground">{bid.bidderContact}</p>
                        )}
                      </div>
                      <span className="font-semibold text-emerald-400">€{bid.amount.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(bid.createdAt).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}

                  {/* Assign next winner button */}
                  {bidData.auctionEnded && bidData.winnerExpiresAt && new Date(bidData.winnerExpiresAt) < new Date() && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await assignNextWinner(item!.id);
                          const updated = await fetchBids(item!.id);
                          setBidData(updated);
                        } catch {
                          setErrors({ form: t("apiError_assign_next_failed") });
                        }
                      }}
                      className="mt-2 w-full rounded-md bg-orange-500/15 px-3 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/25"
                    >
                      {t("assignNextWinner")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === Delete zone (edit only) === */}
          {mode === "edit" && (
            <div className="border-t border-border pt-5">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-destructive px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
              >
                <Trash2 className="size-4" />
                {t("deleteItem")}
              </button>
            </div>
          )}

          {/* Form-level error */}
          {errors.form && (
            <p className="mt-4 text-center text-xs text-destructive">{errors.form}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {uploading ? (
              <><Loader2 className="mr-2 size-4 animate-spin" />{t("uploading")}</>
            ) : saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </>
  );
}
