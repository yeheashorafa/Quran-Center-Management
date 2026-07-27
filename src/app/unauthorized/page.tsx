import Link from "next/link";
import { SadaqaFooter } from "@/components/layout/sadaqa-footer";
import { getDashboardPath } from "@/lib/auth/constants";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-[var(--bg-app)] text-[var(--text-main)] transition-colors duration-200" dir="rtl">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 text-center shadow-xl">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 text-3xl dark:bg-red-950">🔒</div>
          <h1 className="mt-5 text-xl font-black text-[var(--text-main)]">ليس لديك صلاحية لهذه الصفحة</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">تم تسجيل دخولك بدور: {session.role.nameAr}.</p>
          <Link
            href={getDashboardPath(session.role.code)}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-5 font-extrabold text-white"
          >
            العودة إلى لوحتي
          </Link>
        </section>
      </main>
      <SadaqaFooter />
    </div>
  );
}
