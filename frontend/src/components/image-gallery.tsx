"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ItemImage } from "@/lib/items";
import { ImageLightbox } from "@/components/image-lightbox";

interface ImageGalleryProps {
  images: ItemImage[];
  alt?: string;
}

export function ImageGallery({ images, alt = "" }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = sorted.length;

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % total) + total) % total);
    },
    [total]
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  // Keyboard navigation for main gallery (arrows)
  useEffect(() => {
    if (lightboxOpen) return; // lightbox handles its own keys
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, goPrev, goNext]);

  if (total === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
        No images
      </div>
    );
  }

  return (
    <>
      {/* Main image */}
      <div className="relative">
        <div
          onClick={() => setLightboxOpen(true)}
          className="block w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted"
          role="button"
          tabIndex={0}
        >
          <img
            src={sorted[activeIndex].url}
            alt={alt}
            className="aspect-[4/3] w-full object-contain"
          />
        </div>

        {/* Prev/Next on main image */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Counter */}
        {total > 1 && (
          <span className="absolute bottom-2 right-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            {activeIndex + 1} / {total}
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === activeIndex ? "border-primary" : "border-transparent hover:border-border"
              }`}
            >
              <img
                src={img.url}
                alt=""
                className="size-16 object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxOpen && (
        <ImageLightbox
          images={sorted}
          initialIndex={activeIndex}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
