import Link from "next/link";
import { getDashboardPath } from "@/lib/auth/constants";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  const session = await requireSession();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--page-background)] px-4">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-6 text-center shadow-xl shadow-emerald-950/10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 text-3xl">🔒</div>
        <h1 className="mt-5 text-xl font-black text-slate-900">ليس لديك صلاحية لهذه الصفحة</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">تم تسجيل دخولك بدور: {session.role.nameAr}.</p>
        <Link
          href={getDashboardPath(session.role.code)}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand-green)] px-5 font-extrabold text-white"
        >
          العودة إلى لوحتي
        </Link>
      </section>
    </main>
  );
}
