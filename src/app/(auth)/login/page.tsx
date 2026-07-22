import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-900 px-4 py-8 text-slate-900 sm:px-6 sm:py-12" dir="rtl">
      {/* Decorative Quranic Background Ornaments */}
      <div aria-hidden="true" className="absolute -right-32 -top-32 size-96 rounded-full bg-emerald-700/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 -left-32 size-96 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-3xl border border-emerald-500/20 bg-white/95 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-md sm:p-8">
          <div className="flex flex-col items-center text-center">
            <BrandMark />
            {/* <span className="mt-2 text-xs font-black tracking-widest text-emerald-800">
              {appConfig.centerName}
            </span> */}
          </div>

          <div className="my-5 h-px bg-gradient-to-l from-transparent via-emerald-800/30 to-transparent" />

          <div className="mb-6 text-center">
            <h1 className="text-xl font-black text-slate-950">تسجيل الدخول إلى النظام</h1>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
              نظام إدارة الحلقات والتسميع والتقارير الرسمية
            </p>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
