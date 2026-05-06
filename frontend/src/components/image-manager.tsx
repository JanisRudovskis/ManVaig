"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";

// === Types ===

export interface FormImage {
  id: string;
  url: string;
  file?: File;
  isPrimary: boolean;
}

interface ImageManagerProps {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
  maxImages?: number;
  error?: string;
}

// === Helpers ===

function swapImages(images: FormImage[], fromIndex: number, toIndex: number): FormImage[] {
  if (toIndex < 0 || toIndex >= images.length) return images;
  const result = [...images];
  [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
  return result;
}

// === Image thumbnail ===

function ImageThumb({
  index,
  total,
  image,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: {
  index: number;
  total: number;
  image: FormImage;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-border bg-muted">
      <img src={image.url} alt="" className="h-full w-full object-cover" />

      {/* Action bar — bottom */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-black/50 px-1 py-0.5">
        {/* Move left */}
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={isFirst}
          className={`flex size-6 items-center justify-center rounded text-white transition-colors ${
            isFirst ? "opacity-0 pointer-events-none" : "hover:bg-white/20 active:bg-white/30"
          }`}
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Move right */}
        <button
          type="button"
          onClick={onMoveRight}
          disabled={isLast}
          className={`flex size-6 items-center justify-center rounded text-white transition-colors ${
            isLast ? "opacity-0 pointer-events-none" : "hover:bg-white/20 active:bg-white/30"
          }`}
        >
          <ChevronRight className="size-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onRemove}
          className="flex size-6 items-center justify-center rounded text-red-400 transition-colors hover:bg-white/20 active:bg-white/30"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// === Main component ===

export function ImageManager({ images, onChange, maxImages = 5, error }: ImageManagerProps) {
  const t = useTranslations("itemForm");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxToAdd = maxImages - images.length;
    if (maxToAdd <= 0) return;

    const validFiles = fileArray
      .filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024)
      .slice(0, maxToAdd);

    const newImages: FormImage[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
      isPrimary: false,
    }));

    const updated = [...images, ...newImages];
    // First image is always primary
    updated.forEach((img, i) => { img.isPrimary = i === 0; });
    onChange(updated);
  };

  const removeImage = (id: string) => {
    const filtered = images.filter((img) => img.id !== id);
    // First image is always primary
    filtered.forEach((img, i) => { img.isPrimary = i === 0; });
    onChange([...filtered]);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const swapped = swapImages(images, fromIndex, toIndex);
    // First image is always primary
    swapped.forEach((img, i) => { img.isPrimary = i === 0; });
    onChange(swapped);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {images.map((img, i) => (
          <ImageThumb
            key={img.id}
            image={img}
            index={i}
            total={images.length}
            onRemove={() => removeImage(img.id)}
            onMoveLeft={() => moveImage(i, i - 1)}
            onMoveRight={() => moveImage(i, i + 1)}
          />
        ))}
        {images.length < maxImages && (
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

      <p className="mt-2 text-xs text-muted-foreground">{t("imagesHintSimple")}</p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
