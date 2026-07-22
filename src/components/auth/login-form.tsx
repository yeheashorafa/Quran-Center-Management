"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginRoles } from "@/config/app";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import type { LoginOptionsResponse } from "@/lib/auth/types";

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [options, setOptions] = useState<LoginOptionsResponse>({ stages: [], users: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [serverError, setServerError] = useState("");

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

        if (!response.ok) throw new Error("تعذر تحميل المستخدمين.");
        setOptions((await response.json()) as LoginOptionsResponse);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
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
          (role !== "TEACHER" || (stageId ? user.stageIds.includes(stageId) : false)),
      ),
    [options.users, role, stageId],
  );

  const selectedRole = loginRoles.find((item) => item.value === role);

  async function onSubmit(input: LoginInput) {
    setServerError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message?: string; redirectTo?: string }
      | null;

    if (!response.ok || !payload?.redirectTo) {
      setServerError(payload?.message ?? "تعذر تسجيل الدخول. حاول مرة أخرى.");
      return;
    }

    router.replace(payload.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <fieldset disabled={isSubmitting}>
        <legend className="mb-2 text-sm font-bold text-slate-800">نوع الدخول</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                className={`rounded-2xl border px-3 py-3 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                  active
                    ? "border-[var(--brand-green)] bg-emerald-50 text-[var(--brand-green)] shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40"
                }`}
              >
                <span className="block text-sm font-extrabold">{item.label}</span>
                <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {role === "TEACHER" ? (
        <div>
          <label htmlFor="stageId" className="form-label">المرحلة</label>
          <select
            id="stageId"
            className="form-control"
            disabled={optionsLoading || isSubmitting}
            {...register("stageId", {
              onChange: () => {
                setValue("userId", "");
                setServerError("");
              },
            })}
          >
            <option value="">اختر المرحلة</option>
            {options.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.label}</option>
            ))}
          </select>
          {errors.stageId ? <p className="mt-2 text-xs font-bold text-red-700">{errors.stageId.message}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="userId" className="form-label">
          {role === "TEACHER" ? "اسم الشيخ" : "اسم المستخدم"}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
            <UserIcon />
          </span>
          <select
            id="userId"
            className="form-control pr-11"
            disabled={optionsLoading || isSubmitting || (role === "TEACHER" && !stageId)}
            {...register("userId")}
          >
            <option value="">
              {optionsLoading
                ? "جاري تحميل المستخدمين..."
                : role === "TEACHER" && !stageId
                  ? "اختر المرحلة أولاً"
                  : "اختر المستخدم"}
            </option>
            {visibleUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.displayName}</option>
            ))}
          </select>
        </div>
        {errors.userId ? <p className="mt-2 text-xs font-bold text-red-700">{errors.userId.message}</p> : null}
        {!optionsLoading && !optionsError && (role !== "TEACHER" || stageId) && visibleUsers.length === 0 ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
            لا يوجد مستخدم نشط لهذا الاختيار حتى الآن.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="form-label">كلمة الدخول</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
            <LockIcon />
          </span>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            className="form-control pr-11"
            placeholder="أدخل كلمة الدخول"
            {...register("password")}
          />
        </div>
        {errors.password ? <p className="mt-2 text-xs font-bold text-red-700">{errors.password.message}</p> : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <input
          type="checkbox"
          disabled={isSubmitting}
          className="mt-1 size-4 accent-[var(--brand-green)]"
          {...register("rememberDevice")}
        />
        <span>
          <span className="block text-sm font-bold text-slate-800">تذكر هذا الجهاز</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            لن تُحفظ كلمة الدخول. سيُحفظ رمز جلسة آمن داخل Cookie محمية فقط.
          </span>
        </span>
      </label>

      {optionsError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold leading-6 text-red-800">
          {optionsError}
        </div>
      ) : null}

      {serverError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold leading-6 text-red-800">
          {serverError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || optionsLoading || Boolean(optionsError)}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand-green)] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[var(--brand-green-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "جاري التحقق..." : "دخول إلى النظام"}
      </button>

      <div className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs leading-6 text-slate-500">
        الدخول المحدد: <strong className="text-slate-700">{selectedRole?.label}</strong>
        {stageId ? <span> — {options.stages.find((stage) => stage.id === stageId)?.label}</span> : null}
      </div>
    </form>
  );
}
