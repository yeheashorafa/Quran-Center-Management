import { createHash } from "node:crypto";

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeArabicName(value: unknown): string {
  return cleanText(value)
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ]/g, "")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

export function normalizeGroupName(value: unknown): string {
  const normalized = normalizeArabicName(value);
  if (normalized.includes("مخيم")) return "مخيم";
  if (normalized.includes("براعم")) return "براعم";
  if (normalized.includes("اشبال")) return "أشبال";
  if (normalized.includes("ناشئ") || normalized.includes("ناشي")) return "ناشئين";
  return cleanText(value);
}

export function stageCodeForGroup(value: unknown): "BRAAIM" | "ASHBAL" | "NASHIEEN" | null {
  const group = normalizeGroupName(value);
  if (group === "براعم") return "BRAAIM";
  if (group === "أشبال") return "ASHBAL";
  if (group === "ناشئين") return "NASHIEEN";
  return null;
}

export function isUuid(value: unknown): boolean {
  return UUID_PATTERN.test(cleanText(value));
}

export function dateOnly(value: unknown): string | null {
  const text = cleanText(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : match[1];
}

export function timestamp(value: unknown, fallback = "1970-01-01T00:00:00.000Z"): string {
  const text = cleanText(value);
  if (!text) return fallback;
  const date = new Date(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function parseBoolean(value: unknown, fallback = false): boolean {
  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes", "نعم"].includes(normalized)) return true;
  if (["false", "0", "no", "لا"].includes(normalized)) return false;
  return fallback;
}

export function parseNumber(value: unknown): number | null {
  const text = cleanText(value).replace(/،/g, ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseInteger(value: unknown): number | null {
  const number = parseNumber(value);
  return number == null ? null : Math.trunc(number);
}

export function safeJson<T>(value: unknown, fallback: T): T {
  const text = cleanText(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function deterministicUuid(namespace: string, key: string): string {
  const digest = createHash("sha256").update(`${namespace}\u0000${key}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function minDate(values: Array<string | null | undefined>): string | null {
  const clean = values.filter((value): value is string => Boolean(value)).sort();
  return clean[0] ?? null;
}

export function maxDate(values: Array<string | null | undefined>): string | null {
  const clean = values.filter((value): value is string => Boolean(value)).sort();
  return clean.at(-1) ?? null;
}

export function previousDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function weekdayForDate(value: string): string {
  const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return weekdays[new Date(`${value}T00:00:00.000Z`).getUTCDay()] ?? "SUNDAY";
}

export function arabicWeekdayForDate(value: string): string {
  const weekdays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return weekdays[new Date(`${value}T00:00:00.000Z`).getUTCDay()] ?? "";
}

export function compactCode(value: string): string {
  return sha256(value).slice(0, 12).toUpperCase();
}
