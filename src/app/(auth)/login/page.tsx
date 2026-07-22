import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { appConfig } from "@/config/app";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--page-background)] px-4 py-6 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="absolute -right-24 -top-24 size-72 rounded-full bg-emerald-100/60 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 -left-24 size-72 rounded-full bg-amber-100/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur sm:p-7">
          <BrandMark />

          <div className="my-6 h-px bg-gradient-to-l from-transparent via-amber-300 to-transparent" />

          <div className="mb-5 text-center">
            <h1 className="text-xl font-extrabold text-slate-900">تسجيل الدخول الآمن</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{appConfig.description}</p>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
