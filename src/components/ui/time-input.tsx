import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Parse typed text into "HH:MM". Missing minutes default to 00, so an hour on
 * its own is already a complete time. Accepts "9", "930", "0930", "9:30",
 * "9.30", "9h30", "9pm", "9:30 am". Returns "" for empty input, null when invalid.
 */
export function parseTimeInput(text: string): string | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return "";
  const m = /^(\d{1,4})(?:\s*[:.h]\s*(\d{0,2}))?\s*(a|p)?\.?m?\.?$/.exec(raw);
  if (!m) return null;
  const period = m[3];
  let [, head, tail] = m;
  if (tail === undefined && head.length > 2) {
    // "930" -> 9:30, "2115" -> 21:15
    tail = head.slice(-2);
    head = head.slice(0, -2);
  }
  if (head.length > 2) return null;
  let hour = Number(head);
  const minute = tail ? Number(tail) : 0;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period === "p" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

interface TimeInputProps {
  idPrefix: string;
  /** "HH:MM" or "" for no time. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
  /** Allow clearing the field (value ""). */
  allowEmpty?: boolean;
  /** Accessible name, e.g. "Due time". */
  label?: string;
  className?: string;
}

/**
 * Keyboard time entry that always reports a complete "HH:MM" (or ""). Valid
 * text is committed while typing; invalid text is flagged and reverted on blur.
 */
export function TimeInput({
  idPrefix,
  value,
  onChange,
  disabled,
  title,
  allowEmpty = true,
  label = "Time",
  className,
}: TimeInputProps) {
  const [text, setText] = useState(value);

  // Follow outside changes (e.g. the due date was cleared or a todo reloaded).
  useEffect(() => {
    setText((current) => (parseTimeInput(current) === value ? current : value));
  }, [value]);

  const parsed = parseTimeInput(text);
  const invalid = parsed === null || (!allowEmpty && parsed === "");

  return (
    <Input
      id={`${idPrefix}-time`}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={allowEmpty ? "HH:MM" : "09:00"}
      value={text}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-invalid={invalid || undefined}
      maxLength={8}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const time = parseTimeInput(next);
        if (time !== null && (allowEmpty || time !== "") && time !== value) {
          onChange(time);
        }
      }}
      onBlur={() => setText(invalid ? value : parsed)}
      className={cn("h-8 w-[90px] text-sm tabular-nums", className)}
    />
  );
}
