"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  X,
  Trash2,
  Clock,
  Info,
  Loader2,
  ArrowRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/datetime-picker";
import { ImageManager } from "@/components/image-manager";
import type { FormImage } from "@/components/image-manager";
import { LocationSearch } from "@/components/location-search";
import { HelpPopover } from "@/components/help-popover";
import { TipsBanner } from "@/components/tips-banner";
import { VisibilityRadioCards } from "@/components/visibility-radio-cards";
import { useTipsDismissed } from "@/lib/use-tips-dismissed";
import { getMyProfile } from "@/lib/auth";
import {
  createItem,
  updateItem,
  deleteItem,
  fetchCategories,
  uploadItemImages,
  reorderItemImages,
  deleteItemImage,
  Condition,
  ItemVisibility,
} from "@/lib/items";
import type {
  ItemResponse,
  CategoryDto,
  CreateItemData,
  UpdateItemData,
} from "@/lib/items";
import type { StallDefaults } from "@/lib/stalls";

// === Constants ===

const TOTAL_TABS = 3;

const conditionOptions = [
  { value: Condition.New, key: "condNew" },
  { value: Condition.LikeNew, key: "condLikeNew" },
  { value: Condition.Good, key: "condGood" },
  { value: Condition.Fair, key: "condFair" },
  { value: Condition.Poor, key: "condPoor" },
];

// === Types ===

interface ItemFormProps {
  mode: "add" | "edit";
  item?: ItemResponse;
  stallId?: string;
  userLocation?: string | null;
  stallDefaults?: StallDefaults;
  onClose?: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

// === Component ===

export function ItemForm({
  mode,
  item,
  stallId,
  userLocation,
  stallDefaults,
  onClose,
  onSaved,
  onDeleted,
}: ItemFormProps) {
  const defaultsActive = mode === "add" && !!stallDefaults;
  const t = useTranslations("itemForm");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { isTabDismissed, dismissTab } = useTipsDismissed();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  const [tabsUnlocked, setTabsUnlocked] = useState(mode === "edit");

  // Form state — Tab 1 (Basic Info)
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? (defaultsActive ? stallDefaults?.categoryId ?? 0 : 0)
  );
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [condition, setCondition] = useState<number>(
    item?.condition ??
      (defaultsActive
        ? stallDefaults?.condition ?? Condition.Good
        : Condition.Good)
  );
  const [location, setLocation] = useState(
    item?.location ??
      (defaultsActive
        ? stallDefaults?.location ?? userLocation ?? ""
        : userLocation ?? "")
  );
  const [images, setImages] = useState<FormImage[]>(() => {
    if (mode === "edit" && item?.images?.length) {
      return item.images.map((img) => ({
        id: img.id,
        url: img.url,
        isPrimary: img.isPrimary,
      }));
    }
    return [];
  });

  // Form state — Tab 2 (Price)
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [acceptOffers, setAcceptOffers] = useState(
    item?.acceptOffers ??
      (defaultsActive ? stallDefaults?.acceptOffers ?? false : false)
  );
  const [minOfferPrice, setMinOfferPrice] = useState(
    item?.minOfferPrice?.toString() ?? ""
  );
  const [offerStep, setOfferStep] = useState(
    item?.offerStep?.toString() ?? ""
  );
  const [enableEndDate, setEnableEndDate] = useState(!!item?.endDate);
  const [endDateTime, setEndDateTime] = useState<Date | undefined>(() => {
    if (item?.endDate) return new Date(item.endDate);
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    return d;
  });
  const endDateIso = endDateTime ? endDateTime.toISOString() : "";

  // Form state — Tab 3 (Options)
  const [visibility, setVisibility] = useState<number>(
    item?.visibility ??
      (defaultsActive
        ? stallDefaults?.visibility ?? ItemVisibility.Public
        : ItemVisibility.Public)
  );
  const [canShip, setCanShip] = useState(
    item?.canShip ?? (defaultsActive ? stallDefaults?.canShip ?? false : false)
  );
  const [tags, setTags] = useState<string[]>(
    item?.tags ?? (defaultsActive ? stallDefaults?.tags ?? [] : [])
  );
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lock body scroll when modal is open (edit mode)
  useEffect(() => {
    if (mode !== "edit") return;
    document.body.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
    return () => {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
    };
  }, [mode]);

  // Load categories
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Pre-fill location from profile (add mode) — only when no stall default
  useEffect(() => {
    if (mode === "add" && !stallDefaults?.location) {
      getMyProfile()
        .then((profile) => {
          if (profile.location) setLocation(profile.location);
        })
        .catch(() => {});
    }
  }, [mode, stallDefaults?.location]);

  // === Scroll helper ===

  const scrollToTop = () => {
    if (mode === "add") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // === Tab navigation ===

  const handleTabClick = (tabIndex: number) => {
    if (tabIndex === activeTab) return;

    // In add mode, clicking locked tabs triggers tab 1 validation
    if (mode === "add" && tabIndex > 0 && !tabsUnlocked) {
      if (validateTab1()) {
        setTabsUnlocked(true);
        setActiveTab(tabIndex);
        scrollToTop();
      }
      return;
    }

    setActiveTab(tabIndex);
    setErrors({});
    scrollToTop();
  };

  // === Accept offers toggle with value transfer ===

  const handleAcceptOffersChange = (checked: boolean) => {
    setAcceptOffers(checked);
    if (checked) {
      // Toggle ON: transfer price → min offer, clear price (becomes instant buy)
      if (price && !minOfferPrice) {
        setMinOfferPrice(price);
      }
      setPrice("");
    } else {
      // Toggle OFF: transfer min offer → price if price is empty
      if (!price && minOfferPrice) {
        setPrice(minOfferPrice);
      }
      setMinOfferPrice("");
    }
  };

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

  const validateTab1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!categoryId) errs.category = t("errorCategoryRequired");
    if (images.length === 0) errs.images = t("errorImagesRequired");
    const trimmedTitle = title.trim();
    if (!trimmedTitle) errs.title = t("errorTitleRequired");
    else if (trimmedTitle.length < 3 || trimmedTitle.length > 100)
      errs.title = t("errorTitleLength");
    if (description.length > 2000)
      errs.description = t("errorDescriptionLength");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTab2 = (): boolean => {
    const errs: Record<string, string> = {};

    if (!acceptOffers) {
      // Fixed price mode: price required
      if (!price) errs.price = t("errorPriceRequired");
      else {
        const priceNum = parseFloat(price);
        if (priceNum <= 0) errs.price = t("errorPriceRequired");
        else if (hasMoreThan2Decimals(price))
          errs.price = t("errorPriceDecimals");
      }
    }

    if (acceptOffers) {
      // Min offer validation
      if (minOfferPrice) {
        const minNum = parseFloat(minOfferPrice);
        if (minNum < 0) errs.minOfferPrice = t("errorMinOfferNegative");
      }
      // Instant buy validation (optional, but must be valid if set)
      if (price) {
        const priceNum = parseFloat(price);
        if (priceNum <= 0) errs.price = t("errorPriceRequired");
        else if (hasMoreThan2Decimals(price))
          errs.price = t("errorPriceDecimals");
      }
      if (!offerStep) errs.offerStep = t("errorOfferStepRequired");
      else if (parseFloat(offerStep) <= 0)
        errs.offerStep = t("errorOfferStepPositive");

      if (enableEndDate) {
        if (!endDateTime) errs.endDate = t("errorEndDateRequired");
        else {
          const fiveHoursFromNow = Date.now() + 5 * 60 * 60 * 1000;
          if (endDateTime.getTime() <= fiveHoursFromNow)
            errs.endDate = t("errorEndDateMinDuration");
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTab3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (tags.some((tg) => tg.length > 30)) errs.tags = t("errorTagLength");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // === Next (add mode: tab 1 → 2, tab 2 → 3) ===

  const handleNext = () => {
    if (activeTab === 0) {
      if (validateTab1()) {
        setTabsUnlocked(true);
        setActiveTab(1);
        setErrors({});
        scrollToTop();
      }
    } else if (activeTab === 1) {
      setActiveTab(2);
      setErrors({});
      scrollToTop();
    }
  };

  // === Save / Publish ===

  const handleSave = async () => {
    // Validate tab 1
    const tab1Valid = validateTab1();
    if (!tab1Valid) {
      if (activeTab !== 0) {
        setActiveTab(0);
        scrollToTop();
      }
      return;
    }

    // Validate tab 2
    const tab2Valid = validateTab2();
    if (!tab2Valid) {
      if (activeTab !== 1) {
        setActiveTab(1);
        scrollToTop();
      }
      return;
    }

    // Validate tab 3
    const tab3Valid = validateTab3();
    if (!tab3Valid) {
      if (activeTab !== 2) {
        setActiveTab(2);
        scrollToTop();
      }
      return;
    }

    setSaving(true);
    try {
      if (mode === "add") {
        const data: CreateItemData = {
          stallId: stallId!,
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          condition,
          price: price ? parseFloat(price) : null,
          acceptOffers,
          minOfferPrice:
            acceptOffers && minOfferPrice ? parseFloat(minOfferPrice) : null,
          offerStep:
            acceptOffers && offerStep ? parseFloat(offerStep) : null,
          endDate:
            acceptOffers && enableEndDate && endDateIso ? endDateIso : null,
          visibility,
          location: location || undefined,
          canShip,

          tags: tags.length > 0 ? tags : undefined,
        };
        const created = await createItem(data);

        const newFiles = images
          .filter((img) => img.file)
          .map((img) => img.file!);
        if (newFiles.length > 0) {
          setUploading(true);
          await uploadItemImages(created.id, newFiles);
        }
      } else {
        // Edit mode
        const data: UpdateItemData = {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          condition,
          price: price ? parseFloat(price) : null,
          acceptOffers,
          minOfferPrice:
            acceptOffers && minOfferPrice ? parseFloat(minOfferPrice) : null,
          offerStep:
            acceptOffers && offerStep ? parseFloat(offerStep) : null,
          endDate:
            acceptOffers && enableEndDate && endDateIso ? endDateIso : null,
          visibility,
          location: location || "",
          canShip,

          tags,
          clearPricingFields: true,
        };
        await updateItem(item!.id, data);

        // Upload new images
        const newFiles = images
          .filter((img) => img.file)
          .map((img) => img.file!);
        if (newFiles.length > 0) {
          setUploading(true);
          await uploadItemImages(item!.id, newFiles);
        }

        // Delete removed images
        if (item!.images) {
          const currentIds = new Set(
            images.filter((img) => !img.file).map((img) => img.id)
          );
          const deletedImages = item!.images.filter(
            (img) => !currentIds.has(img.id)
          );
          for (const img of deletedImages) {
            await deleteItemImage(item!.id, img.id);
          }
        }

        // Reorder if needed
        const serverImages = images.filter((img) => !img.file);
        if (serverImages.length > 1) {
          await reorderItemImages(
            item!.id,
            serverImages.map((img) => img.id)
          );
        }
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

  // === Delete (edit mode) ===

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const deleteDelay = (item?.bidCount ?? 0) > 0 ? 5 : 3;

  useEffect(() => {
    if (!showDeleteDialog) return;
    setDeleteCountdown(deleteDelay);
    const interval = setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showDeleteDialog, deleteDelay]);

  const handleDelete = () => setShowDeleteDialog(true);

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    setSaving(true);
    try {
      await deleteItem(item!.id);
      onDeleted?.();
    } catch {
      setErrors({ form: t("errorDeleteFailed") });
    } finally {
      setSaving(false);
    }
  };

  const primaryImage =
    item?.images?.find((img) => img.isPrimary) ?? item?.images?.[0];

  const deleteDialog = showDeleteDialog && (
    <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setShowDeleteDialog(false)}
      />
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Item preview */}
        <div className="mb-4 flex items-center gap-3">
          {primaryImage && (
            <img
              src={primaryImage.url}
              alt=""
              className="size-12 rounded-lg object-cover"
            />
          )}
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {item?.title}
          </p>
        </div>

        {/* Warning */}
        <div className="mb-5 rounded-lg bg-destructive/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" />
            {t("deleteDialogTitle")}
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-destructive">•</span>
              {t("deleteConsequenceData")}
            </li>
            {(item?.bidCount ?? 0) > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-destructive">•</span>
                {t("deleteConsequenceOffers", { count: item!.bidCount })}
              </li>
            )}
          </ul>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowDeleteDialog(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={deleteCountdown > 0}
            onClick={confirmDelete}
          >
            {deleteCountdown > 0
              ? t("deleteCountdown", { seconds: deleteCountdown })
              : t("deleteConfirmButton")}
          </Button>
        </div>
      </div>
    </div>
  );

  // ==================== TAB BAR ====================

  const tabs = [
    { label: t("tabBasicInfo"), index: 0 },
    { label: t("tabPrice"), index: 1 },
    { label: t("tabOptions"), index: 2 },
  ];

  const tabButtons = (
    <>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.index;
        const isLocked =
          mode === "add" && tab.index > 0 && !tabsUnlocked;
        const isCompleted =
          mode === "add" &&
          tab.index === 0 &&
          tabsUnlocked &&
          activeTab !== 0;

        return (
          <button
            key={tab.index}
            onClick={() => handleTabClick(tab.index)}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
              isActive && "text-foreground",
              !isActive &&
                !isLocked &&
                "text-muted-foreground hover:text-foreground",
              isLocked && "text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <span className="flex items-center gap-1.5">
              {isCompleted && (
                <Check className="size-3.5 text-emerald-400" />
              )}
              {mode === "add" && `${tab.index + 1}. `}
              {tab.label}
            </span>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        );
      })}
    </>
  );

  // ==================== TAB 1: Basic Info ====================

  const tab1Content = (
    <div>
      {!isTabDismissed("details") && (
        <TipsBanner tab="details" onDismiss={() => dismissTab("details")} />
      )}
      {/* Category */}
      <div className="mb-6">
        <Label className="mb-1.5">{t("fieldCategory")} *</Label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(parseInt(e.target.value))}
          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 [&>option]:bg-background [&>option]:text-foreground"
        >
          <option value={0}>{t("categoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {tc.has(String(c.id)) ? tc(String(c.id)) : c.name}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-xs text-destructive">{errors.category}</p>
        )}
      </div>

      {/* Images */}
      <div className="mb-7">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sectionImages")} *
        </div>
        <ImageManager
          images={images}
          onChange={setImages}
          error={errors.images}
        />
        <p className="mt-2 text-xs text-muted-foreground">{t("imagesInlineHint")}</p>
      </div>

      {/* Basic Info fields */}
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
            ) : (
              <span />
            )}
            <span
              className={`text-xs ${
                title.length > 90
                  ? "text-orange-400"
                  : "text-muted-foreground"
              }`}
            >
              {t("charCount", { count: title.length, max: 100 })}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("titleHint")}</p>
        </div>

        {/* Description */}
        <div className="mb-4">
          <Label className="mb-1.5">{t("fieldDescription")}</Label>
          <Textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value.slice(0, 2000))
            }
            placeholder={t("fieldDescriptionPlaceholder")}
            rows={3}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-xs text-destructive">
                {errors.description}
              </p>
            ) : (
              <span />
            )}
            <span
              className={`text-xs ${
                description.length > 1900
                  ? "text-orange-400"
                  : "text-muted-foreground"
              }`}
            >
              {t("charCount", { count: description.length, max: 2000 })}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("descriptionHint")}</p>
        </div>

        {/* Condition */}
        <div className="mb-4">
          <Label className="mb-1.5">{t("fieldCondition")} <HelpPopover helpKey="condition" /></Label>
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
          <p className="mt-1 text-xs text-muted-foreground">
            {t("locationHint")}
          </p>
        </div>
      </div>

      {/* Next button (add mode only) */}
      {mode === "add" && (
        <Button onClick={handleNext} className="w-full" size="lg">
          {t("wizardNext")}
          <ArrowRight className="ml-2 size-4" />
        </Button>
      )}
    </div>
  );

  // ==================== TAB 2: Price ====================

  const tab2Content = (
    <div>
      {!isTabDismissed("pricing") && (
        <TipsBanner tab="pricing" onDismiss={() => dismissTab("pricing")} />
      )}
      {/* Pricing section */}
      <div className="mb-7">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sectionPricing")}
        </div>

        {/* Fixed price field (only when offers OFF) */}
        {!acceptOffers && (
          <div className="mb-4">
            <Label className="mb-1.5">{t("fieldPrice")} *</Label>
            <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  if (
                    /^\d*\.?\d{0,2}$/.test(e.target.value) ||
                    e.target.value === ""
                  )
                    setPrice(e.target.value);
                }}
                placeholder="0.00"
                className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
              />
              <span className="flex items-center pr-3 text-sm text-muted-foreground">
                €
              </span>
            </div>
            {errors.price ? (
              <p className="mt-1 text-xs text-destructive">{errors.price}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t("priceHint")}</p>
            )}
          </div>
        )}

        {/* Accept offers toggle */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {t("acceptOffersLabel")}
                <HelpPopover helpKey="acceptOffers" />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("acceptOffersHint")}
              </p>
            </div>
            <Switch
              checked={acceptOffers}
              onCheckedChange={handleAcceptOffersChange}
            />
          </div>

          {/* Offer sub-fields */}
          {acceptOffers && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {/* Min offer price (starting price) */}
              <div>
                <Label className="mb-1.5">
                  {t("fieldMinOfferPrice")} <HelpPopover helpKey="minOfferPrice" />
                </Label>
                <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minOfferPrice}
                    onChange={(e) => {
                      if (
                        /^\d*\.?\d{0,2}$/.test(e.target.value) ||
                        e.target.value === ""
                      )
                        setMinOfferPrice(e.target.value);
                    }}
                    placeholder="0.00"
                    className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                  />
                  <span className="flex items-center pr-3 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("minOfferHint")}
                </p>
                {errors.minOfferPrice && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.minOfferPrice}
                  </p>
                )}
              </div>

              {/* Offer step */}
              <div>
                <Label className="mb-1.5">{t("fieldOfferStep")} *</Label>
                <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={offerStep}
                    onChange={(e) => {
                      if (
                        /^\d*\.?\d{0,2}$/.test(e.target.value) ||
                        e.target.value === ""
                      )
                        setOfferStep(e.target.value);
                    }}
                    placeholder="1.00"
                    className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                  />
                  <span className="flex items-center pr-3 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("offerStepHint")}
                </p>
                {errors.offerStep && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.offerStep}
                  </p>
                )}
              </div>

              {/* Instant buy price */}
              <div>
                <Label className="mb-1.5">
                  {t("fieldInstantBuyPrice")}
                </Label>
                <div className="flex max-w-[200px] rounded-md border border-border bg-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => {
                      if (
                        /^\d*\.?\d{0,2}$/.test(e.target.value) ||
                        e.target.value === ""
                      )
                        setPrice(e.target.value);
                    }}
                    placeholder="0.00"
                    className="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                  />
                  <span className="flex items-center pr-3 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("instantBuyHint")}
                </p>
                {errors.price && (
                  <p className="mt-1 text-xs text-destructive">{errors.price}</p>
                )}
              </div>

              {/* End date toggle */}
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-orange-400" />
                      <p className="text-sm font-medium">
                        {t("setEndDateLabel")}
                      </p>
                      <HelpPopover helpKey="endDate" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("setEndDateHint")}
                    </p>
                  </div>
                  <Switch
                    checked={enableEndDate}
                    onCheckedChange={setEnableEndDate}
                  />
                </div>

                {enableEndDate && (
                  <div className="mt-3 border-t border-border pt-3">
                    <DateTimePicker
                      value={endDateTime}
                      onChange={setEndDateTime}
                      locale={locale}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.endDate}
                      </p>
                    )}
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-300">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      <span>{t("antiSniperNote")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Next button (add mode) */}
      {mode === "add" && (
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => handleTabClick(0)}
            className="flex-1"
            size="lg"
          >
            <ChevronLeft className="mr-1 size-4" />
            {t("wizardBackStep")}
          </Button>
          <Button onClick={handleNext} className="flex-1" size="lg">
            {t("wizardNext")}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // ==================== TAB 3: Options ====================

  const tab3Content = (
    <div>
      {!isTabDismissed("terms") && (
        <TipsBanner tab="terms" onDismiss={() => dismissTab("terms")} />
      )}
      {/* Tags */}
      <div className="mb-7">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sectionTags")}
          <HelpPopover helpKey="tags" />
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("tagPurpose")}</p>
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
        <p className="mt-1 text-xs text-muted-foreground">{t("tagHint")}</p>
        <div className="mt-1 flex items-center justify-between">
          {errors.tags ? (
            <p className="text-xs text-destructive">{errors.tags}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            {tags.length} / 10 {t("tagsCount")}
          </span>
        </div>
      </div>

      {/* Visibility & Options */}
      <div className="mb-7">
        <div
          id="item-form-visibility-heading"
          className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("sectionVisibility")}
        </div>

        <div className="mb-4">
          <Label className="mb-1.5">
            {t("fieldVisibility")} <HelpPopover helpKey="visibility" />
          </Label>
          <VisibilityRadioCards
            mode="item"
            value={visibility}
            onChange={setVisibility}
            labelledBy="item-form-visibility-heading"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("visibilityHint")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">{t("canShip")}</p>
            <p className="text-xs text-muted-foreground">
              {t("canShipHint")}
            </p>
          </div>
          <Switch checked={canShip} onCheckedChange={setCanShip} />
        </div>
      </div>

      {/* Form-level error */}
      {errors.form && (
        <p className="mt-4 text-center text-xs text-destructive">
          {errors.form}
        </p>
      )}

      {/* Footer buttons (add mode) */}
      {mode === "add" && (
        <div className="flex gap-3 pt-6 pb-8">
          <Button
            variant="outline"
            onClick={() => handleTabClick(1)}
            className="flex-1"
            size="lg"
          >
            <ChevronLeft className="mr-1 size-4" />
            {t("wizardBackStep")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex-1"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("uploading")}
              </>
            ) : saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("wizardPublish")
            )}
          </Button>
        </div>
      )}
    </div>
  );

  // ==================== Tab content selector ====================

  const activeTabContent =
    activeTab === 0
      ? tab1Content
      : activeTab === 1
        ? tab2Content
        : tab3Content;

  // ==================== Stall-defaults applied banner ====================

  const hasAnyDefault =
    !!stallDefaults &&
    (stallDefaults.categoryId !== null ||
      (stallDefaults.location?.length ?? 0) > 0 ||
      stallDefaults.canShip ||
      stallDefaults.condition !== null ||
      stallDefaults.acceptOffers ||
      stallDefaults.tags.length > 0 ||
      stallDefaults.visibility !== ItemVisibility.Public);

  const stallDefaultsBanner =
    defaultsActive && hasAnyDefault ? (
      <div
        className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
        role="status"
      >
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <p className="text-xs text-muted-foreground">
          {t("stallDefaultsApplied")}
        </p>
      </div>
    ) : null;

  // ==================== RENDER: ADD MODE (full page) ====================

  if (mode === "add") {
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
        </div>

        {/* Tab bar */}
        <div className="border-b border-border">
          <div className="flex justify-center -mb-px">{tabButtons}</div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mt-4 mb-6">
          {Array.from({ length: TOTAL_TABS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                activeTab >= i ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {stallDefaultsBanner}

        {/* Tab content */}
        {activeTabContent}
      </div>
    );
  }

  // ==================== RENDER: EDIT MODE (modal) ====================

  return (
    <>
      {/* Delete confirmation dialog */}
      {deleteDialog}

      {/* Overlay */}
      <div
        className="pointer-events-auto fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="pointer-events-auto fixed inset-2 z-51 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:h-[85vh] md:w-[640px] md:-translate-x-1/2 md:-translate-y-1/2">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">{t("titleEdit")}</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 border-b border-border">
          <div className="flex justify-center px-6 -mb-px">
            {tabButtons}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-6">
          {activeTabContent}
        </div>

        {/* Form error (visible on any tab) */}
        {errors.form && (
          <div className="shrink-0 px-6 pb-2">
            <p className="text-center text-xs text-destructive">
              {errors.form}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center border-t border-border px-6 py-4">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
          >
            <Trash2 className="size-4" />
            {t("deleteItem")}
          </button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : saving ? (
                t("saving")
              ) : (
                t("save")
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
