"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import {
  createItem,
  fetchCategories,
  uploadItemImages,
  PricingType,
  Condition,
  ItemVisibility,
} from "@/lib/items";
import type { CategoryDto, CreateItemData } from "@/lib/items";
import { ImageManager } from "@/components/image-manager";
import type { FormImage } from "@/components/image-manager";
import { LocationSearch } from "@/components/location-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { lv } from "date-fns/locale/lv";
import { enUS } from "date-fns/locale/en-US";
import {
  ChevronLeft,
  X,
  DollarSign,
  MessageCircle,
  TrendingUp,
  Clock,
  Info,
  Loader2,
  CalendarIcon,
  ArrowRight,
} from "lucide-react";

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

const TOTAL_STEPS = 3;

// === Main Page ===

export default function AddItemPage() {
  const t = useTranslations("itemForm");
  const router = useRouter();
  const params = useParams();
  const stallId = params.id as string;
  const locale = useLocale();
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 state
  const [categoryId, setCategoryId] = useState(0);
  const [pricingType, setPricingType] = useState<number>(PricingType.Fixed);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  // Step 2 state (describe your item)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<number>(Condition.Used);
  const [location, setLocation] = useState("");

  // Image state
  const [images, setImages] = useState<FormImage[]>([]);
  const [uploading, setUploading] = useState(false);

  // Step 3 state (set your terms)
  const [price, setPrice] = useState("");
  const [minBidPrice, setMinBidPrice] = useState("");
  const [bidStep, setBidStep] = useState("");
  const [auctionEndDate, setAuctionEndDate] = useState<Date | undefined>(undefined);
  const [auctionEndTime, setAuctionEndTime] = useState("23:59");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dateFnsLocale = locale === "lv" ? lv : enUS;
  const auctionEndIso = (() => {
    if (!auctionEndDate || !auctionEndTime.match(/^\d{2}:\d{2}$/)) return "";
    const y = auctionEndDate.getFullYear();
    const m = String(auctionEndDate.getMonth() + 1).padStart(2, "0");
    const d = String(auctionEndDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}T${auctionEndTime}`;
  })();
  const [visibility, setVisibility] = useState<number>(ItemVisibility.Public);
  const [canShip, setCanShip] = useState(false);
  const [allowGuestOffers, setAllowGuestOffers] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load categories
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
    }
  }, [authLoading, isLoggedIn, router]);

  // === Tags ===

  const addTag = (value: string) => {
    const normalized = value.trim().toLowerCase().slice(0, 30);
    if (!normalized || tags.length >= 10 || tags.includes(normalized)) return;
    setTags([...tags, normalized]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tg) => tg !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  // === Validation ===

  const hasMoreThan2Decimals = (val: string) => {
    const parts = val.split(".");
    return parts.length === 2 && parts[1].length > 2;
  };

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!categoryId) errs.category = t("errorCategoryRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};

    if (images.length === 0) errs.images = t("errorImagesRequired");

    const trimmedTitle = title.trim();
    if (!trimmedTitle) errs.title = t("errorTitleRequired");
    else if (trimmedTitle.length < 3 || trimmedTitle.length > 100) errs.title = t("errorTitleLength");

    if (description.length > 2000) errs.description = t("errorDescriptionLength");

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};

    if (tags.some((tg) => tg.length > 30)) errs.tags = t("errorTagLength");

    if (pricingType === PricingType.Fixed || pricingType === PricingType.FixedOffers) {
      const priceNum = parseFloat(price);
      if (!price || priceNum <= 0) errs.price = t("errorPriceRequired");
      else if (hasMoreThan2Decimals(price)) errs.price = t("errorPriceDecimals");

      if (pricingType === PricingType.FixedOffers && minBidPrice) {
        const minNum = parseFloat(minBidPrice);
        if (minNum > priceNum) errs.minBidPrice = t("errorMinOfferExceedsPrice");
      }
    }

    if (pricingType === PricingType.Bidding) {
      if (minBidPrice && parseFloat(minBidPrice) <= 0) errs.minBidPrice = t("errorMinBidPositive");
      if (bidStep && parseFloat(bidStep) <= 0) errs.bidStep = t("errorBidStepPositive");
    }

    if (pricingType === PricingType.Auction) {
      if (!minBidPrice || parseFloat(minBidPrice) <= 0) errs.minBidPrice = t("errorAuctionStartRequired");
      if (bidStep && parseFloat(bidStep) <= 0) errs.bidStep = t("errorBidStepPositive");
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

  // === Step navigation ===

  const goToStep = (target: number) => {
    setStep(target);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) goToStep(2);
    else if (step === 2 && validateStep2()) goToStep(3);
  };

  const handleBack = () => {
    if (step > 1) goToStep(step - 1);
  };

  // === Save ===

  const handlePublish = async () => {
    if (!validateStep3()) return;

    setSaving(true);
    try {
      const data: CreateItemData = {
        stallId,
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

      // Upload images
      const newFiles = images.filter((img) => img.file).map((img) => img.file!);
      if (newFiles.length > 0) {
        setUploading(true);
        await uploadItemImages(created.id, newFiles);
      }

      router.push(`/my-stalls/${stallId}`);
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

  // === Derived values ===
  const selectedPricingConfig = pricingTypes.find((pt) => pt.type === pricingType)!;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  if (authLoading) return null;

  // === Summary chip (shown on steps 2 & 3) ===
  const summaryChip = (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <selectedPricingConfig.icon className={`size-5 shrink-0 ${
        selectedPricingConfig.key === "fixed" ? "text-blue-500" :
        selectedPricingConfig.key === "offers" ? "text-purple-500" :
        "text-orange-500"
      }`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{t(`pricing_${selectedPricingConfig.key}`)}</span>
        {selectedCategory && (
          <span className="text-sm text-muted-foreground"> · {selectedCategory.name}</span>
        )}
      </div>
      <button
        onClick={() => goToStep(1)}
        className="shrink-0 text-xs font-medium text-primary hover:underline"
      >
        {t("wizardChange")}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[640px] px-4 py-4 md:px-6 md:py-6">
      {/* Back link */}
      <Link
        href={`/my-stalls/${stallId}`}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 -ml-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-4"
      >
        <ChevronLeft className="size-4" />
        {t("wizardBack")}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("titleAdd")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("wizardStep", { current: step, total: TOTAL_STEPS })}
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${step >= i + 1 ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {/* ==================== STEP 1: What are you selling? ==================== */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-1">{t("wizardStep1Title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("wizardStep1Desc")}</p>

          {/* Category */}
          <div className="mb-6">
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

          {/* Pricing Type */}
          <div className="mb-8">
            <Label className="mb-3">{t("sectionPricing")} *</Label>
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
          </div>

          {/* Next button */}
          <Button onClick={handleNext} className="w-full" size="lg">
            {t("wizardNext")}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}

      {/* ==================== STEP 2: Describe your item ==================== */}
      {step === 2 && (
        <div>
          {summaryChip}

          <h2 className="text-lg font-semibold mb-1">{t("wizardStep2Title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("wizardStep2Desc")}</p>

          {/* === Images === */}
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

          {/* === Basic Info === */}
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
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 pt-2 pb-8">
            <Button variant="outline" onClick={handleBack} className="flex-1" size="lg">
              <ChevronLeft className="mr-1 size-4" />
              {t("wizardBackStep")}
            </Button>
            <Button onClick={handleNext} className="flex-1" size="lg">
              {t("wizardNext")}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ==================== STEP 3: Set your terms ==================== */}
      {step === 3 && (
        <div>
          {summaryChip}

          <h2 className="text-lg font-semibold mb-1">{t("wizardStep3Title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("wizardStep3Desc")}</p>

          {/* === Pricing Fields (specific to selected type) === */}
          <div className="mb-7">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`pricing_${selectedPricingConfig.key}`)}
            </div>

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
                  <span className="flex items-center pr-3 text-sm text-muted-foreground">€</span>
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
                  <span className="flex items-center pr-3 text-sm text-muted-foreground">€</span>
                </div>
                {errors.minBidPrice && <p className="mt-1 text-xs text-destructive">{errors.minBidPrice}</p>}
              </div>
            )}

            {/* Bidding → MinBidPrice + BidStep */}
            {pricingType === PricingType.Bidding && (
              <>
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
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">€</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t("biddingHint")}</p>
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
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">€</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t("bidStepHint")}</p>
                  {errors.bidStep && <p className="mt-1 text-xs text-destructive">{errors.bidStep}</p>}
                </div>
              </>
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
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">€</span>
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
                    <span className="flex items-center pr-3 text-sm text-muted-foreground">€</span>
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

          {/* === Tags === */}
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

          {/* === Visibility & Options === */}
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

          {/* Form-level error */}
          {errors.form && (
            <p className="mb-4 text-center text-xs text-destructive">{errors.form}</p>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 pt-2 pb-8">
            <Button variant="outline" onClick={handleBack} className="flex-1" size="lg">
              <ChevronLeft className="mr-1 size-4" />
              {t("wizardBackStep")}
            </Button>
            <Button onClick={handlePublish} disabled={saving || uploading} className="flex-1" size="lg">
              {uploading ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />{t("uploading")}</>
              ) : saving ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />{t("saving")}</>
              ) : (
                t("wizardPublish")
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
