import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let cachedLogoBase64: string | null = null;

export function getReportLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;

  try {
    const logoPath = path.join(process.cwd(), "public", "brand", "logo-light.png");
    if (existsSync(logoPath)) {
      const buffer = readFileSync(logoPath);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.warn("Failed to load report logo as Base64:", err);
  }

  return "";
}
