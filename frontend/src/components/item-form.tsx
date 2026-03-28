"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Plus,
  Star,
  Trash2,
  MapPin,
  ImageIcon,
  DollarSign,
  MessageCircle,
  TrendingUp,
  Clock,
  Info,
  GripVertical,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createItem,
  updateItem,
  deleteItem,
  fetchCategories,
  uploadItemImages,
  reorderItemImages,
  deleteItemImage,
  PricingType,
  Condition,
  ItemVisibility,
} from "@/lib/items";
import type { ItemResponse, ItemImage, CategoryDto, CreateItemData, UpdateItemData } from "@/lib/items";

// === Types ===

interface ItemFormProps {
  mode: "add" | "edit";
  item?: ItemResponse | null;
  userLocation?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

// === Image types ===

interface FormImage {
  id: string;
  url: string; // Cloudinary URL for existing images, blob URL for new
  file?: File; // Only for new images not yet uploaded
  isPrimary: boolean;
}

// === Sortable image thumbnail ===

function SortableImageThumb({
  image,
  onRemove,
  onSetPrimary,
}: {
  image: FormImage;
  onRemove: () => void;
  onSetPrimary: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square overflow-hidden rounded-lg border-2 border-border bg-muted"
    >
      <img
        src={image.url}
        alt=""
        className="h-full w-full object-cover"
      />
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 flex size-6 cursor-grab items-center justify-center rounded bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      {/* Primary star */}
      <button
        onClick={onSetPrimary}
        className={`absolute top-1 right-1 flex size-6 items-center justify-center rounded transition-opacity ${
          image.isPrimary
            ? "bg-yellow-500 text-white"
            : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        <Star className="size-3.5" fill={image.isPrimary ? "currentColor" : "none"} />
      </button>
      {/* Delete */}
      <button
        onClick={onRemove}
        className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded bg-black/60 text-red-400 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
      {/* Pending upload indicator */}
      {image.file && (
        <div className="absolute bottom-1 left-1 rounded bg-blue-500/80 px-1.5 py-0.5 text-[0.55rem] text-white">
          NEW
        </div>
      )}
    </div>
  );
}

// === Nominatim location result ===

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

// === Component ===

export function ItemForm({ mode, item, userLocation, onClose, onSaved, onDeleted }: ItemFormProps) {
  const t = useTranslations("itemForm");

  // Form state
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? 0);
  const [condition, setCondition] = useState(item?.condition ?? Condition.Used);
  const [pricingType, setPricingType] = useState(item?.pricingType ?? PricingType.Fixed);
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [minBidPrice, setMinBidPrice] = useState(item?.minBidPrice?.toString() ?? "");
  const [bidStep, setBidStep] = useState(item?.bidStep?.toString() ?? "");
  const [auctionEnd, setAuctionEnd] = useState(item?.auctionEnd?.slice(0, 16) ?? "");
  const [visibility, setVisibility] = useState(item?.visibility ?? ItemVisibility.Public);
  const [location, setLocation] = useState(item?.location ?? userLocation ?? "");
  const [locationSelected, setLocationSelected] = useState(!!(item?.location || userLocation));
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<{ city: string; country: string; display: string }[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // DnD sensors — pointer (mouse) + touch (mobile long-press)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Load categories
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // === Image handlers ===

  const addImageFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxToAdd = 5 - images.length;
    if (maxToAdd <= 0) return;

    const validFiles = fileArray
      .filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024)
      .slice(0, maxToAdd);

    const newImages: FormImage[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
      isPrimary: images.length === 0 && validFiles.indexOf(file) === 0,
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      // If removed image was primary, make first remaining primary
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return [...filtered];
    });
  };

  const setPrimaryImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) => ({ ...img, isPrimary: img.id === id }))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setImages((prev) => {
      const oldIndex = prev.findIndex((img) => img.id === active.id);
      const newIndex = prev.findIndex((img) => img.id === over.id);
      const reordered = [...prev];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      return reordered;
    });
  };

  // === Location autocomplete (Nominatim) ===

  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 2) {
      setLocationResults([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: NominatimResult[] = await res.json();
      setLocationResults(
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
      setLocationOpen(true);
    } catch {
      // Nominatim down — user can type manually
      setLocationResults([]);
    }
  }, []);

  const onLocationInput = (value: string) => {
    setLocationQuery(value);
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    locationTimerRef.current = setTimeout(() => searchLocation(value), 300);
  };

  const selectLocation = (display: string) => {
    setLocation(display);
    setLocationSelected(true);
    setLocationOpen(false);
    setLocationQuery("");
    setLocationResults([]);
  };

  const clearLocation = () => {
    setLocation("");
    setLocationSelected(false);
    setLocationQuery("");
  };

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
      if (!auctionEnd) errs.auctionEnd = t("errorAuctionEndRequired");
      else {
        const endTime = new Date(auctionEnd).getTime();
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
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          condition,
          pricingType,
          price: price ? parseFloat(price) : null,
          minBidPrice: minBidPrice ? parseFloat(minBidPrice) : null,
          bidStep: bidStep ? parseFloat(bidStep) : null,
          auctionEnd: auctionEnd || null,
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
          auctionEnd: auctionEnd || null,
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
      const message = err instanceof Error ? err.message : t("errorSaveFailed");
      setErrors({ form: message });
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addImageFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-5 gap-2 max-[480px]:grid-cols-3">
                  {images.map((img) => (
                    <SortableImageThumb
                      key={img.id}
                      image={img}
                      onRemove={() => removeImage(img.id)}
                      onSetPrimary={() => setPrimaryImage(img.id)}
                    />
                  ))}
                  {images.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-muted-foreground"
                    >
                      <Plus className="size-5" />
                      <span className="text-[0.6rem]">{t("upload")}</span>
                    </button>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <p className="mt-2 text-xs text-muted-foreground">{t("imagesHint")}</p>
            {errors.images && <p className="mt-1 text-xs text-destructive">{errors.images}</p>}
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
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
              >
                <option value={0}>{t("categoryPlaceholder")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category}</p>}
            </div>

            {/* Location */}
            <div className="mb-4">
              <Label className="mb-1.5">{t("fieldLocation")}</Label>
              <div className="relative">
                {locationSelected ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{location}</span>
                    <button
                      onClick={clearLocation}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={locationQuery}
                      onChange={(e) => onLocationInput(e.target.value)}
                      onFocus={() => locationResults.length > 0 && setLocationOpen(true)}
                      onBlur={() => setTimeout(() => setLocationOpen(false), 200)}
                      placeholder={t("locationPlaceholder")}
                    />
                    {locationOpen && locationResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {locationResults.map((r, i) => (
                          <button
                            key={i}
                            className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-muted"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectLocation(r.display)}
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
                  <div className="flex overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                    <span className="flex items-center border-r border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                      EUR
                    </span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="flex-1 border-0 bg-input px-3 py-2 text-sm text-foreground outline-none"
                    />
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
                  <div className="flex overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                    <span className="flex items-center border-r border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                      EUR
                    </span>
                    <input
                      type="number"
                      value={minBidPrice}
                      onChange={(e) => setMinBidPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="flex-1 border-0 bg-input px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </div>
                  {errors.minBidPrice && <p className="mt-1 text-xs text-destructive">{errors.minBidPrice}</p>}
                </div>
              )}

              {/* Bidding → MinBidPrice */}
              {pricingType === PricingType.Bidding && (
                <div className="mb-4">
                  <Label className="mb-1.5">{t("fieldMinPrice")}</Label>
                  <div className="flex overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                    <span className="flex items-center border-r border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                      EUR
                    </span>
                    <input
                      type="number"
                      value={minBidPrice}
                      onChange={(e) => setMinBidPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="flex-1 border-0 bg-input px-3 py-2 text-sm text-foreground outline-none"
                    />
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
                    <div className="flex overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                      <span className="flex items-center border-r border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                        EUR
                      </span>
                      <input
                        type="number"
                        value={minBidPrice}
                        onChange={(e) => setMinBidPrice(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="flex-1 border-0 bg-input px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                    {errors.minBidPrice && <p className="mt-1 text-xs text-destructive">{errors.minBidPrice}</p>}
                  </div>
                  <div className="mb-4">
                    <Label className="mb-1.5">{t("fieldBidStep")}</Label>
                    <div className="flex overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                      <span className="flex items-center border-r border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                        EUR
                      </span>
                      <input
                        type="number"
                        value={bidStep}
                        onChange={(e) => setBidStep(e.target.value)}
                        placeholder="10.00"
                        step="1"
                        min="1"
                        className="flex-1 border-0 bg-input px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("bidStepHint")}</p>
                    {errors.bidStep && <p className="mt-1 text-xs text-destructive">{errors.bidStep}</p>}
                  </div>
                  <div className="mb-4">
                    <Label className="mb-1.5">{t("fieldEndDate")} *</Label>
                    <input
                      type="datetime-local"
                      value={auctionEnd}
                      onChange={(e) => setAuctionEnd(e.target.value)}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                    />
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
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
              >
                {visibilityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
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
