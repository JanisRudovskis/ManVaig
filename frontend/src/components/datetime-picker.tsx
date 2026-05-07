"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Latvian } from "flatpickr/dist/l10n/lv.js";
import "flatpickr/dist/flatpickr.min.css";
import "flatpickr/dist/themes/dark.css";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  locale?: string;
  minDate?: Date | "today";
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  locale = "lv",
  minDate = "today",
  placeholder = "DD.MM.YYYY HH:MM",
  className,
}: DateTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    fpRef.current = flatpickr(inputRef.current, {
      enableTime: true,
      time_24hr: true,
      dateFormat: "d.m.Y H:i",
      locale: locale === "lv" ? Latvian : undefined,
      minDate,
      defaultDate: value,
      onChange: (selectedDates) => {
        onChange(selectedDates[0] ?? undefined);
      },
    });

    return () => {
      fpRef.current?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Sync external value changes
  useEffect(() => {
    if (!fpRef.current) return;
    if (value) {
      fpRef.current.setDate(value, false);
    } else {
      fpRef.current.clear(false);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      readOnly
      className={`w-full cursor-pointer rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 ${className ?? ""}`}
    />
  );
}
