"use client";

import { useEffect, useState } from "react";
import { Download, Info, CheckCircle2, XCircle, RefreshCw, X, ShieldAlert } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface DiagnosticResult {
  title: string;
  ok: boolean;
  message: string;
  details?: string;
}

interface DiagnosticsReport {
  isHttps: DiagnosticResult;
  isChrome: DiagnosticResult;
  isStandalone: DiagnosticResult;
  swRegistered: DiagnosticResult;
  swActive: DiagnosticResult;
  swController: DiagnosticResult;
  manifestReadable: DiagnosticResult;
  manifestName: DiagnosticResult;
  manifestShortName: DiagnosticResult;
  manifestStartUrl: DiagnosticResult;
  manifestScope: DiagnosticResult;
  manifestDisplay: DiagnosticResult;
  icon192: DiagnosticResult;
  icon512: DiagnosticResult;
  beforeInstallPromptFired: DiagnosticResult;
  appInstalledFired: DiagnosticResult;
  cacheVersion: DiagnosticResult;
}

export function PwaInstallSection() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [promptFired, setPromptFired] = useState<boolean>(false);
  const [appInstalled, setAppInstalled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  });
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showDiagModal, setShowDiagModal] = useState<boolean>(false);

  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPromptFired(true);
    }

    function handleAppInstalled() {
      setAppInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function runDiagnostics() {
    setIsDiagnosing(true);

    const isHttpsOk =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const isHttpsRes: DiagnosticResult = {
      title: "الاتصال الآمن (HTTPS)",
      ok: isHttpsOk,
      message: isHttpsOk ? "الموقع يشتغل بروتوكول آمن HTTPS." : "الموقع لا يشتغل بروتوكول آمن HTTPS (مطلوب للتثبيت).",
      details: window.location.protocol,
    };

    const ua = navigator.userAgent;
    const isChromeLike = /Chrome|Chromium|CriOS/.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua);
    const isChromeRes: DiagnosticResult = {
      title: "نوع المتصفح (Chrome/Chromium)",
      ok: isChromeLike,
      message: isChromeLike
        ? "المتصفح هو Google Chrome / Chromium."
        : "المتصفح ليس Chrome (قد تختلف طريقة التثبيت حسب المتصفح).",
    };

    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const isStandaloneRes: DiagnosticResult = {
      title: "وضع التطبيق (Standalone)",
      ok: !isStandaloneMode,
      message: isStandaloneMode
        ? "التطبيق يعمل حالياً بالفعل كـ Standalone (مثبت)."
        : "التطبيق يعمل داخل المتصفح العادي (متاح للتثبيت).",
    };

    let swRegOk = false;
    let swActiveOk = false;
    let swControllerOk = false;
    let swRegDetails = "";

    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          swRegOk = true;
          swActiveOk = Boolean(reg.active);
          swRegDetails = reg.scope;
        }
      } catch (err) {
        swRegDetails = String(err);
      }
      swControllerOk = Boolean(navigator.serviceWorker.controller);
    }

    const swRegRes: DiagnosticResult = {
      title: "تسجيل Service Worker",
      ok: swRegOk,
      message: swRegOk ? "Service Worker مسجل بنجاح." : "Service Worker غير مسجل على هذا الجهاز.",
      details: swRegDetails,
    };

    const swActiveRes: DiagnosticResult = {
      title: "حالة Service Worker (Active)",
      ok: swActiveOk,
      message: swActiveOk ? "Service Worker نشط (Active) ويعمل." : "Service Worker غير نشط بعد.",
    };

    const swControllerRes: DiagnosticResult = {
      title: "التحكم عبر Service Worker (Controller)",
      ok: swControllerOk,
      message: swControllerOk
        ? "Service Worker يتحكم بالصفحة (Controller active)."
        : "لا يوجد controller من Service Worker حالياً. أعد تحميل الصفحة مرة واحدة ثم جرّب التثبيت.",
    };

    let manifestOk = false;
    let manifestData: Record<string, unknown> | null = null;
    let manifestErr = "";

    const linkManifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "/manifest.json";

    try {
      const res = await fetch(linkManifest, { cache: "no-store" });
      if (res.ok) {
        manifestData = (await res.json()) as Record<string, unknown>;
        manifestOk = Boolean(manifestData && typeof manifestData === "object");
      } else {
        manifestErr = `HTTP ${res.status}`;
      }
    } catch (err) {
      manifestErr = String(err);
    }

    const manifestRes: DiagnosticResult = {
      title: "قراءة ملف Manifest",
      ok: manifestOk,
      message: manifestOk ? "تمت قراءة ملف manifest.json بنجاح." : "تعذر قراءة ملف manifest.json.",
      details: manifestErr || linkManifest,
    };

    const manifestNameVal = typeof manifestData?.name === "string" ? manifestData.name : "";
    const manifestNameRes: DiagnosticResult = {
      title: "اسم التطبيق (manifest.name)",
      ok: Boolean(manifestNameVal),
      message: manifestNameVal ? `الاسم: "${manifestNameVal}"` : "خاصية name مفقودة أو فارغة.",
    };

    const manifestShortNameVal = typeof manifestData?.short_name === "string" ? manifestData.short_name : "";
    const manifestShortNameRes: DiagnosticResult = {
      title: "الاسم المختصر (manifest.short_name)",
      ok: Boolean(manifestShortNameVal),
      message: manifestShortNameVal ? `الاسم المختصر: "${manifestShortNameVal}"` : "خاصية short_name مفقودة.",
    };

    const manifestStartUrlVal = typeof manifestData?.start_url === "string" ? manifestData.start_url : "";
    const manifestStartUrlRes: DiagnosticResult = {
      title: "رابط البداية (manifest.start_url)",
      ok: Boolean(manifestStartUrlVal),
      message: manifestStartUrlVal ? `القيمة: "${manifestStartUrlVal}"` : "خاصية start_url مفقودة.",
    };

    const manifestScopeVal = typeof manifestData?.scope === "string" ? manifestData.scope : "";
    const manifestScopeRes: DiagnosticResult = {
      title: "نطاق التطبيق (manifest.scope)",
      ok: manifestScopeVal === "/",
      message: manifestScopeVal === "/" ? 'القيمة: "/"' : `القيمة غير متوقعة: "${manifestScopeVal}" (المتوقع "/")`,
    };

    const manifestDisplayVal = typeof manifestData?.display === "string" ? manifestData.display : "";
    const manifestDisplayRes: DiagnosticResult = {
      title: "نمط العرض (manifest.display)",
      ok: manifestDisplayVal === "standalone" || manifestDisplayVal === "fullscreen",
      message:
        manifestDisplayVal === "standalone" || manifestDisplayVal === "fullscreen"
          ? `القيمة: "${manifestDisplayVal}"`
          : `نمط العرض غير مناسب للتثبيت: "${manifestDisplayVal}"`,
    };

    let icon192Ok = false;
    let icon192Details = "";
    let icon512Ok = false;
    let icon512Details = "";

    if (manifestData && Array.isArray(manifestData.icons)) {
      type IconItem = { src?: string; sizes?: string; type?: string };
      const icons = manifestData.icons as IconItem[];

      const icon192Item = icons.find((i) => i.sizes === "192x192");
      const icon512Item = icons.find((i) => i.sizes === "512x512");

      if (icon192Item?.src) {
        try {
          const imgRes = await fetch(icon192Item.src, { cache: "no-store" });
          if (imgRes.ok) {
            icon192Ok = true;
            icon192Details = `HTTP ${imgRes.status} (${icon192Item.src})`;
          } else {
            icon192Details = `HTTP ${imgRes.status}`;
          }
        } catch (e) {
          icon192Details = String(e);
        }
      } else {
        icon192Details = "أيقونة 192x192 غير موجودة في manifest";
      }

      if (icon512Item?.src) {
        try {
          const imgRes = await fetch(icon512Item.src, { cache: "no-store" });
          if (imgRes.ok) {
            icon512Ok = true;
            icon512Details = `HTTP ${imgRes.status} (${icon512Item.src})`;
          } else {
            icon512Details = `HTTP ${imgRes.status}`;
          }
        } catch (e) {
          icon512Details = String(e);
        }
      } else {
        icon512Details = "أيقونة 512x512 غير موجودة في manifest";
      }
    }

    const icon192Res: DiagnosticResult = {
      title: "أيقونة التطبيق (192x192)",
      ok: icon192Ok,
      message: icon192Ok ? "أيقونة 192x192 سليمة وتعمل." : "تعذر التحقق من أيقونة 192x192.",
      details: icon192Details,
    };

    const icon512Res: DiagnosticResult = {
      title: "أيقونة التطبيق (512x512)",
      ok: icon512Ok,
      message: icon512Ok ? "أيقونة 512x512 سليمة وتعمل." : "تعذر التحقق من أيقونة 512x512.",
      details: icon512Details,
    };

    const beforeInstallRes: DiagnosticResult = {
      title: "حدث التثبيت (beforeinstallprompt)",
      ok: promptFired || Boolean(deferredPrompt),
      message:
        promptFired || Boolean(deferredPrompt)
          ? "أطلق المتصفح حدث التثبيت beforeinstallprompt بنجاح."
          : "لم يطلق المتصفح حدث التثبيت بعد.",
    };

    const appInstalledRes: DiagnosticResult = {
      title: "حدث اكتمال التثبيت (appinstalled)",
      ok: true,
      message: appInstalled ? "تم تسجيل تثبيت التطبيق سابقا." : "لم يتم التثبيت بعد.",
    };

    let cacheVersionStr = "مجهول";
    if (typeof caches !== "undefined") {
      try {
        const keys = await caches.keys();
        const mutaqinCache = keys.find((k) => k.includes("mutaqin-offline-shell"));
        if (mutaqinCache) {
          cacheVersionStr = mutaqinCache;
        } else if (keys.length > 0) {
          cacheVersionStr = keys.join(", ");
        }
      } catch {}
    }

    const cacheVersionRes: DiagnosticResult = {
      title: "إصدار الكاش الحجمي (SW Cache)",
      ok: cacheVersionStr.includes("v16"),
      message: `نسخة الكاش: ${cacheVersionStr}`,
    };

    setDiagnostics({
      isHttps: isHttpsRes,
      isChrome: isChromeRes,
      isStandalone: isStandaloneRes,
      swRegistered: swRegRes,
      swActive: swActiveRes,
      swController: swControllerRes,
      manifestReadable: manifestRes,
      manifestName: manifestNameRes,
      manifestShortName: manifestShortNameRes,
      manifestStartUrl: manifestStartUrlRes,
      manifestScope: manifestScopeRes,
      manifestDisplay: manifestDisplayRes,
      icon192: icon192Res,
      icon512: icon512Res,
      beforeInstallPromptFired: beforeInstallRes,
      appInstalledFired: appInstalledRes,
      cacheVersion: cacheVersionRes,
    });

    setIsDiagnosing(false);
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setAppInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("Failed to prompt PWA install:", err);
      }
    } else {
      setShowGuideModal(true);
    }
  }

  function handleOpenDiagnostics() {
    setShowGuideModal(false);
    setShowDiagModal(true);
    void runDiagnostics();
  }

  return (
    <div className="mt-4 w-full space-y-3">
      {/* Install & Diagnostics Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-800 transition active:scale-[0.99]"
        >
          <Download className="size-4" />
          <span>تثبيت التطبيق</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowDiagModal(true);
            void runDiagnostics();
          }}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--text-main)] hover:border-[var(--primary)] transition active:scale-[0.99]"
          title="فحص صلاحية وتوفر تثبيت PWA"
        >
          <Info className="size-4 text-[var(--primary)]" />
          <span>فحص التثبيت</span>
        </button>
      </div>

      {/* Guide Modal when beforeinstallprompt has not fired */}
      {showGuideModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-500 shrink-0" />
                <h3 className="text-base font-black text-[var(--text-main)]">طريقة تثبيت التطبيق على هذا الجهاز</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--card-soft)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[var(--text-main)] font-semibold">
              <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400 font-bold">
                لم يرسل المتصفح طلب التثبيت التلقائي لهذا الجهاز.
              </p>

              <div className="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-4">
                <p className="font-black text-sm text-[var(--primary)]">خطوات التثبيت اليدوي من متصفح Chrome:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs">
                  <li>افتح قائمة الخيارات في Chrome بالنقر على <strong>⋮ (الثلاث نقاط بالفي أعلى المتصفح)</strong>.</li>
                  <li>اختر <strong>إضافة إلى الشاشة الرئيسية</strong> (Add to Home screen) أو <strong>تثبيت التطبيق</strong>.</li>
                  <li>أكّد الإضافة لظهور أيقونة التطبيق على شاشتك.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-700 dark:text-sky-300 font-medium">
                📱 <strong>تنويه لأجهزة شاومي/ريدمي (MIUI):</strong> قد تحتاج تفعيل صلاحية &quot;إنشاء اختصارات الشاشة الرئيسية&quot; لتطبيق Chrome من إعدادات الهاتف (إعدادات النظام ← التطبيقات ← إدارة التطبيقات ← Chrome ← الأذونات الأخرى).
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={handleOpenDiagnostics}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-xs font-black text-white hover:opacity-90 transition"
              >
                <Info className="size-4" />
                <span>افتح فحص التثبيت لمعرفة السبب</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 py-2.5 text-xs font-bold text-[var(--text-main)] hover:opacity-80"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Diagnostics Modal */}
      {showDiagModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] p-5">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-[var(--primary)] shrink-0" />
                <h3 className="text-base font-black text-[var(--text-main)]">نتائج فحص جاهزية تثبيت الـ PWA</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runDiagnostics()}
                  disabled={isDiagnosing}
                  className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)] hover:border-[var(--primary)] transition disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isDiagnosing ? "animate-spin" : ""}`} />
                  <span>إعادة الفحص</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiagModal(false)}
                  className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--card-soft)]"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 dir-rtl text-right">
              {isDiagnosing ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <div className="size-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                  <p className="text-xs font-bold text-[var(--text-muted)]">جاري فحص جميع متطلبات التثبيت والمعلمات...</p>
                </div>
              ) : diagnostics ? (
                <div className="space-y-2.5">
                  {Object.entries(diagnostics).map(([key, item]) => (
                    <div
                      key={key}
                      className={`flex flex-col gap-1 rounded-2xl border p-3 text-xs transition ${
                        item.ok
                          ? "border-emerald-500/20 bg-emerald-500/5 text-[var(--text-main)]"
                          : "border-rose-500/20 bg-rose-500/5 text-[var(--text-main)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-xs text-[var(--text-main)]">{item.title}</span>
                        {item.ok ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            <span>سليم</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-0.5 text-[11px] font-black text-rose-700 dark:text-rose-400">
                            <XCircle className="size-3.5" />
                            <span>فيه مشكلة</span>
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] font-semibold text-[var(--text-muted)] leading-relaxed">
                        {item.message}
                      </p>

                      {item.details ? (
                        <code className="mt-0.5 rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] dir-ltr text-right inline-block w-fit">
                          {item.details}
                        </code>
                      ) : null}
                    </div>
                  ))}

                  {/* SW Controller Special Notice */}
                  {!diagnostics.swController.ok ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-bold text-amber-700 dark:text-amber-300 space-y-1">
                      <p>⚠️ <strong>توجيه مهم:</strong> Service Worker مسجل ولكن لا يوجد Controller نشط حالياً على هذه الصفحة.</p>
                      <p>أعد تحميل الصفحة مرة واحدة ثم جرّب التثبيت.</p>
                    </div>
                  ) : null}

                  {/* Xiaomi/Redmi Special Note */}
                  <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-800 dark:text-sky-200 leading-relaxed font-semibold">
                    📱 <strong>ملاحظة لأجهزة Xiaomi / Redmi / MIUI:</strong> إذا كانت جميع البنود أعلاه سليمة ✅ ومع ذلك لا يظهر الخيار في Chrome، يرجع السبب غالباً إلى سياسة نظام MIUI التي تحظر على Chrome إنشاء اختصارات الشاشة الرئيسية تلقائياً. يمكنك تفعيل الخيار من:
                    <br />
                    <em>إعدادات الهاتف ← التطبيقات ← Chrome ← الأذونات الأخرى ← إشعارات/اختصارات الشاشة الرئيسية (Home screen shortcuts) ← سماح دائماً.</em>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[var(--border-color)] p-4 text-left">
              <button
                type="button"
                onClick={() => setShowDiagModal(false)}
                className="rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-xs font-black text-white hover:opacity-90"
              >
                إغلاق الفحص
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
