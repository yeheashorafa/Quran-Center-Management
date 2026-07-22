export function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}
