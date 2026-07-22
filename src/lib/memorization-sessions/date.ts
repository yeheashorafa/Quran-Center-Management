import type { WeekdayCode } from "@/lib/halaqat/weekdays";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const JS_DAY_TO_WEEKDAY: Record<number, WeekdayCode> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export function isIsoDateOnly(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = dateOnlyToUtc(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

export function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function weekdayFromDateOnly(value: string): WeekdayCode {
  const date = dateOnlyToUtc(value);
  return JS_DAY_TO_WEEKDAY[date.getUTCDay()];
}

export function todayInPalestine(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hebron",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isFutureDateInPalestine(value: string): boolean {
  return value > todayInPalestine();
}
