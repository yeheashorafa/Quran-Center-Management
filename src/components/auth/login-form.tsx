"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { loginRoles } from "@/config/app";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import type { LoginOptionsResponse } from "@/lib/auth/types";
import {
  getOfflineExaminerProfile,
  getOfflineTeacherProfile,
  saveOfflineExaminerProfile,
  saveOfflineTeacherProfile,
  type OfflineExaminerProfile,
  type OfflineTeacherProfile,
} from "@/lib/offline/offline-profile";
import { getManagerDataCache } from "@/lib/offline/manager-cache";

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();

  const [options, setOptions] = useState<LoginOptionsResponse>({
    stages: [],
    users: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [teacherProfile, setTeacherProfile] = useState<OfflineTeacherProfile | null>(null);
  const [examinerProfile, setExaminerProfile] = useState<OfflineExaminerProfile | null>(null);
  const [isClientOffline, setIsClientOffline] = useState(false);
  const [isOfflineLogout] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("offlineLogout") === "1";
    }
    return false;
  });

  useEffect(() => {
    function updateOnlineStatus() {
      setIsClientOffline(!navigator.onLine);
    }
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      role: "TEACHER",
      stageId: "",
      userId: "",
      password: "",
      rememberDevice: false,
    },
  });

  const role = useWatch({ control, name: "role" });
  const stageId = useWatch({ control, name: "stageId" });

  const [hasManagerCache, setHasManagerCache] = useState(false);

  useEffect(() => {
    void getOfflineTeacherProfile().then(setTeacherProfile);
    void getOfflineExaminerProfile().then(setExaminerProfile);
    void getManagerDataCache().then((cache) => setHasManagerCache(!!cache));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      try {
        setOptionsLoading(true);
        setOptionsError("");

        const response = await fetch("/api/auth/options", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("تعذر تحميل قائمة المستخدمين.");

        const json = (await response.json()) as LoginOptionsResponse;
        setOptions(json);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;

        setOptionsError("تعذر الاتصال بقاعدة البيانات وتحميل المستخدمين.");
      } finally {
        setOptionsLoading(false);
      }
    }

    void loadOptions();

    return () => controller.abort();
  }, []);

  const visibleUsers = useMemo(
    () =>
      options.users.filter(
        (user) =>
          user.roles.includes(role) &&
          (role !== "TEACHER" ||
            (stageId
              ? user.stageIds.includes(stageId)
              : user.stageIds.length > 0)),
      ),
    [options.users, role, stageId],
  );

  useEffect(() => {
    if (role === "CENTER_MANAGER") {
      const manager = options.users.find((user) =>
        user.roles.includes("CENTER_MANAGER"),
      );

      if (manager) {
        setValue("userId", manager.id, { shouldValidate: true });
      }
    } else if (role === "EXAMINER") {
      const examiner = options.users.find((user) =>
        user.roles.includes("EXAMINER"),
      );

      if (examiner) {
        setValue("userId", examiner.id, { shouldValidate: true });
      }
    }
  }, [role, options.users, setValue]);

  async function onSubmit(input: LoginInput) {
    setServerError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      redirectTo?: string;
    } | null;

    if (!response.ok || !payload?.redirectTo) {
      setServerError(
        payload?.message ?? "تعذر تسجيل الدخول. تأكد من كلمة المرور.",
      );
      return;
    }

    // Save non-sensitive offline profile based on role (NO PASSWORDS OR TOKENS)
    if (input.role === "TEACHER" && input.userId) {
      const teacherUser = options.users.find((u) => u.id === input.userId);
      await saveOfflineTeacherProfile({
        teacherId: input.userId,
        halaqaId: "",
        teacherName: teacherUser?.displayName || "الشيخ",
        halaqaName: "",
      });
    } else if (input.role === "EXAMINER" && input.userId) {
      const examinerUser = options.users.find((u) => u.id === input.userId);
      await saveOfflineExaminerProfile({
        examinerId: input.userId,
        examinerName: examinerUser?.displayName || "المختبر",
      });
    }

    router.replace(payload.redirectTo);
    router.refresh();
  }

  if (isClientOffline) {
    const hasAnyCache = teacherProfile || examinerProfile || hasManagerCache;

    return (
      <div className="space-y-4 text-right">
        {isOfflineLogout ? (
          <div className="rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-xs font-bold text-[var(--status-info-text)] shadow-xs leading-relaxed">
            ℹ️ تم تسجيل الخروج محلياً. يمكنك الدخول أوفلاين كشيخ أو مختبر أو عرض نسخة المدير إذا كانت بياناتك محفوظة مسبقاً على هذا الجهاز.
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-xs font-bold text-[var(--status-warning-text)] shadow-xs space-y-1">
          <div className="flex items-center gap-2 font-black text-sm text-[var(--status-warning-text)]">
            <span>📡</span>
            <span>أنت غير متصل بالإنترنت</span>
          </div>
          <p className="opacity-90 leading-relaxed">
            يمكنك الوصول للبيانات المحفوظة مسبقاً على هذا الجهاز فقط.
          </p>
        </div>

        {hasAnyCache ? (
          <div className="space-y-3 pt-2">
            {teacherProfile ? (
              <button
                type="button"
                onClick={() => {
                  try { localStorage.setItem("offline_role", "TEACHER"); } catch {}
                  window.location.href = "/offline-teacher";
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-[var(--primary-dark)] active:scale-[0.99]"
              >
                📖 الدخول أوفلاين كشيخ ({teacherProfile.teacherName})
              </button>
            ) : null}

            {examinerProfile ? (
              <button
                type="button"
                onClick={() => {
                  try { localStorage.setItem("offline_role", "EXAMINER"); } catch {}
                  window.location.href = "/offline-examiner";
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary-dark)] px-5 py-3 text-sm font-black text-white shadow-md transition hover:opacity-90 active:scale-[0.99]"
              >
                📝 الدخول أوفلاين كمختبر ({examinerProfile.examinerName})
              </button>
            ) : null}

            {hasManagerCache ? (
              <button
                type="button"
                onClick={() => {
                  try { localStorage.setItem("offline_role", "CENTER_MANAGER"); } catch {}
                  window.location.href = "/offline-manager";
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-indigo-800 active:scale-[0.99]"
              >
                📊 عرض آخر نسخة محفوظة للمدير (قراءة فقط)
              </button>
            ) : null}

            <a
              href="/offline-shell.html"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 py-2.5 text-xs font-black text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
            >
              🔍 فحص البيانات المحفوظة (Offline Shell)
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-xs font-extrabold text-[var(--status-danger-text)] shadow-xs leading-relaxed space-y-3">
            <p>
              ⚠️ لا توجد بيانات محفوظة على هذا الجهاز.<br />
              افتح لوحة المحفظ أو المختبر أو المدير مرة واحدة أثناء الاتصال بالإنترنت حتى يتم حفظ نسخة للعمل بدون إنترنت.
            </p>
            <a
              href="/offline-shell.html"
              className="inline-block rounded-xl border border-[var(--status-danger-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-black text-[var(--text-main)]"
            >
              🔍 فحص الذاكرة المحفظة
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Offline Shortcuts Banner for Teacher, Examiner & Manager */}
      {teacherProfile || examinerProfile || hasManagerCache ? (
        <aside aria-label="اختصارات العمل أوفلاين" className="rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-xs font-bold text-[var(--status-success-text)] shadow-xs">
          <div className="flex flex-col gap-2">
            <p className="font-black text-sm text-[var(--status-success-text)]">
              🟢 البيانات المحفوظة محلياً على هذا الجهاز للعمل بدون إنترنت:
            </p>
            <div className="flex flex-col gap-2 pt-1">
              {teacherProfile ? (
                <button
                  type="button"
                  onClick={() => router.push("/offline-teacher")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-black text-white shadow-xs hover:opacity-90 transition"
                >
                  📖 الدخول أوفلاين كشيخ ({teacherProfile.teacherName})
                </button>
              ) : null}

              {examinerProfile ? (
                <button
                  type="button"
                  onClick={() => router.push("/offline-examiner")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-dark)] px-4 py-2.5 text-xs font-black text-white shadow-xs hover:opacity-90 transition"
                >
                  📝 الدخول أوفلاين كمختبر ({examinerProfile.examinerName})
                </button>
              ) : null}

              {hasManagerCache ? (
                <button
                  type="button"
                  onClick={() => router.push("/offline-manager")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-indigo-800 transition"
                >
                  📊 عرض آخر نسخة محفوظة للمدير (قراءة فقط)
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      ) : null}

      <fieldset disabled={isSubmitting}>
        <div className="grid grid-cols-3 gap-2">
          {loginRoles.map((item) => {
            const active = item.value === role;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setValue("role", item.value, { shouldValidate: true });
                  setValue("stageId", "");
                  setValue("userId", "");
                  setServerError("");
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-md"
                    : "border-[var(--border-color)] bg-[var(--card-soft)] text-[var(--text-main)] hover:border-[var(--primary)]"
                }`}
              >
                <span className="mb-1 text-xl">
                  {item.value === "CENTER_MANAGER"
                    ? "🏛️"
                    : item.value === "EXAMINER"
                      ? "📝"
                      : "📖"}
                </span>

                <span className="text-xs font-black">{item.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {role === "TEACHER" ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="stageId" className="form-label">
              إختر المرحلة  (البراعم - الأشبال - الناشئيين)
            </label>

            <div className="relative">
              <select
                id="stageId"
                className="font-bold text-xs"
                disabled={optionsLoading || isSubmitting}
                {...register("stageId", {
                  onChange: () => {
                    setValue("userId", "");
                    setServerError("");
                  },
                })}
              >
                <option value="">جميع المراحل</option>

                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="userId" className="form-label">
              إسم المحفّظ
            </label>

            <div className="relative flex h-12 w-full items-center overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-main)] transition focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-[var(--primary-light)]">
              <span className="flex h-full w-10 shrink-0 items-center justify-center text-[var(--text-muted)]">
                <UserIcon />
              </span>

              <select
                id="userId"
                dir="rtl"
                className="nested-select h-full min-w-0 flex-1 bg-transparent px-2 text-right text-xs font-bold text-[var(--text-main)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={optionsLoading || isSubmitting}
                {...register("userId")}
              >
                <option value="">
                  {optionsLoading ? "جاري تحميل قائمة الشيوخ..." : "اختر الشيخ"}
                </option>

                {visibleUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>

              <span className="pointer-events-none flex h-full w-10 shrink-0 items-center justify-center text-[var(--primary)]">
                <ChevronDown className="size-4" />
              </span>
            </div>

            {errors.userId ? (
              <p className="mt-1.5 text-xs font-bold text-[var(--status-danger-text)]">
                {errors.userId.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor="password" className="form-label">
          كلمة المرور
        </label>

        <div className="flex h-12 w-full items-center overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-main)] transition focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-[var(--primary-light)]">
          <span className="flex h-full w-12 shrink-0 items-center justify-center text-[var(--text-muted)]">
            <LockIcon />
          </span>

          <input
            id="password"
            dir="rtl"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            disabled={isSubmitting}
            className="h-full min-w-0 flex-1 bg-transparent px-1 text-right font-bold tracking-wide text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="أدخل كلمة المرور"
            {...register("password")}
          />

          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={isSubmitting}
            className="flex h-full w-12 shrink-0 items-center justify-center text-[var(--text-muted)] transition hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={
              showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
            }
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>

        {errors.password ? (
          <p className="mt-1.5 text-xs font-bold text-[var(--status-danger-text)]">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 text-xs font-bold text-[var(--text-main)]">
        <input
          type="checkbox"
          disabled={isSubmitting}
          className="size-4 rounded-md accent-[var(--primary)]"
          {...register("rememberDevice")}
        />

        <span>تذكر هذا الجهاز للجلسات القادمة</span>
      </label>

      {optionsError ? (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs font-extrabold text-[var(--status-danger-text)]"
        >
          ⚠️ {optionsError}
        </div>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs font-extrabold text-[var(--status-danger-text)]"
        >
          ⚠️ {serverError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || optionsLoading || Boolean(optionsError)}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-light)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>جاري التحقق والدخول...</span>
          </span>
        ) : (
          "تسجيل الدخول للنظام"
        )}
      </button>
    </form>
  );
}
