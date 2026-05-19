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
  const lastDateStrRef = useRef(value?.toDateString() ?? "");

  useEffect(() => {
    if (!inputRef.current) return;

    fpRef.current = flatpickr(inputRef.current, {
      enableTime: true,
      time_24hr: true,
      dateFormat: "d.m.Y H:i",
      locale: locale === "lv" ? Latvian : undefined,
      minDate,
      defaultDate: value,
      appendTo: document.body,
      onChange: (selectedDates) => {
        const picked = selectedDates[0];
        onChange(picked ?? undefined);

        // Auto-close when a day cell was clicked (date changed), not on time-only adjustments
        const pickedDateStr = picked?.toDateString() ?? "";
        if (pickedDateStr && pickedDateStr !== lastDateStrRef.current) {
          lastDateStrRef.current = pickedDateStr;
          setTimeout(() => fpRef.current?.close(), 0);
        }
      },
    });

    // The edit modal sets document.body pointer-events: none to lock background.
    // Since the calendar is now appended to body, it inherits that — override it.
    fpRef.current.calendarContainer.style.pointerEvents = "auto";

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
      lastDateStrRef.current = value.toDateString();
    } else {
      fpRef.current.clear(false);
      lastDateStrRef.current = "";
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
