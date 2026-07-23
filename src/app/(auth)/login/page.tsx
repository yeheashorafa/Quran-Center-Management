import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--bg-app)] px-4 py-8 text-[var(--text-main)] transition-colors duration-200 sm:px-6 sm:py-12" dir="rtl">
      {/* Decorative Ornaments */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-[var(--primary)]/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full bg-[var(--gold)]/10 blur-3xl" />

      {/* Top Bar with Theme Toggle */}
      <div className="mx-auto flex w-full max-w-md items-center justify-end pb-4">
        <ThemeToggle showLabel />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-lg backdrop-blur-md transition-colors duration-200 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <BrandMark />
          </div>

          <div className="my-5 h-px bg-gradient-to-l from-transparent via-[var(--border-color)] to-transparent" />

          <div className="mb-6 text-center">
            <h1 className="text-xl font-black text-[var(--text-main)]">تسجيل الدخول إلى النظام</h1>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">
              نظام إدارة الحلقات والتسميع والتقارير الرسمية
            </p>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
