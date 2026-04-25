"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchCategories } from "@/lib/items";
import type { CategoryDto } from "@/lib/items";

interface CategoryChipsProps {
  selected: number | null; // null = "For You" (all)
  onChange: (categoryId: number | null) => void;
}

export function CategoryChips({ selected, onChange }: CategoryChipsProps) {
  const t = useTranslations("feed");
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const chipBase =
    "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap";
  const chipActive = "bg-primary text-primary-foreground border-primary";
  const chipInactive = "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* "For You" chip — always first */}
      <button
        className={`${chipBase} ${selected === null ? chipActive : chipInactive}`}
        onClick={() => onChange(null)}
      >
        {t("forYou")}
      </button>

      {/* Category chips */}
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`${chipBase} ${selected === cat.id ? chipActive : chipInactive}`}
          onClick={() => onChange(cat.id)}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
