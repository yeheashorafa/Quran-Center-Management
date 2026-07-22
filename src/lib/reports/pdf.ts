import "server-only";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BROWSER_CANDIDATES: Record<NodeJS.Platform, string[]> = {
  aix: [],
  android: [],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  freebsd: ["/usr/local/bin/chromium", "/usr/local/bin/chrome"],
  haiku: [],
  linux: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/microsoft-edge",
  ],
  openbsd: ["/usr/local/bin/chromium"],
  sunos: [],
  win32: [],
  cygwin: [],
  netbsd: [],
};

function windowsCandidates(): string[] {
  const roots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ].filter((value): value is string => Boolean(value));

  return roots.flatMap((root) => [
    path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(root, "Chromium", "Application", "chrome.exe"),
  ]);
}

function findBrowserExecutable(): string | null {
  const configured = process.env.REPORT_BROWSER_EXECUTABLE_PATH?.trim();
  if (configured && existsSync(configured)) return configured;

  const candidates =
    process.platform === "win32"
      ? windowsCandidates()
      : (BROWSER_CANDIDATES[process.platform] ?? []);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function runBrowser(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("انتهت مهلة إنشاء ملف PDF."));
    }, 60_000);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += String(chunk).slice(0, 4000);
    });
    child.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code: number | null) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(stderr || `تعذر تشغيل المتصفح لإنشاء PDF (code ${code}).`));
    });
  });
}

export class ReportBrowserUnavailableError extends Error {}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executable = findBrowserExecutable();
  if (!executable) {
    throw new ReportBrowserUnavailableError(
      "لم يتم العثور على Chrome أو Chromium على الخادم. اضبط REPORT_BROWSER_EXECUTABLE_PATH على مسار المتصفح.",
    );
  }

  const directory = await mkdtemp(path.join(tmpdir(), "qcm-report-"));
  const htmlPath = path.join(directory, "report.html");
  const pdfPath = path.join(directory, "report.pdf");

  try {
    await writeFile(htmlPath, html, "utf8");
    await runBrowser(executable, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--no-first-run",
      "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw",
      `--user-data-dir=${path.join(directory, "browser-profile")}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ]);
    return await readFile(pdfPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
