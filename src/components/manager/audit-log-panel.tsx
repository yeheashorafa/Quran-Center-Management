"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AuditLogPage } from "@/lib/audit-logs/types";

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ar-PS", {
    timeZone: "Asia/Hebron",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-black text-slate-700">{title}</summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-left text-[11px] leading-5 text-slate-600" dir="ltr">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function AuditLogPanel() {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState(dateDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  async function load(requestedPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(requestedPage), pageSize: "20" });
      if (query.trim()) params.set("query", query.trim());
      if (actorUserId) params.set("actorUserId", actorUserId);
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/manager/audit-logs?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: AuditLogPage;
        message?: string;
      };
      if (!response.ok || !payload.data) throw new Error(payload.message || "تعذر تحميل السجل.");
      setData(payload.data);
      setPage(requestedPage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل السجل.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load(1);
    });
    // Initial load only; the form applies subsequent filters explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(1);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-bold text-emerald-700">سجل التدقيق الإداري</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">من غيّر ماذا ومتى؟</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          السجل للقراءة فقط، ويعرض المستخدم والعملية والقيم القديمة والجديدة وبيانات الطلب.
        </p>

        <form className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={submitFilters}>
          <div className="xl:col-span-2">
            <label className="form-label" htmlFor="audit-query">بحث</label>
            <input
              id="audit-query"
              className="form-control"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="العملية أو الكيان أو اسم المستخدم"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="audit-from">من تاريخ</label>
            <input id="audit-from" className="form-control" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="audit-to">إلى تاريخ</label>
            <input id="audit-to" className="form-control" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="audit-user">المستخدم</label>
            <select id="audit-user" className="form-control" value={actorUserId} onChange={(event) => setActorUserId(event.target.value)}>
              <option value="">كل المستخدمين</option>
              {data?.filters.users.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="audit-action">العملية</label>
            <select id="audit-action" className="form-control" value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">كل العمليات</option>
              {data?.filters.actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="audit-entity">الكيان</label>
            <select id="audit-entity" className="form-control" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
              <option value="">كل الكيانات</option>
              {data?.filters.entityTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <button className="min-h-12 self-end rounded-2xl bg-emerald-800 px-5 text-sm font-black text-white hover:bg-emerald-900">
            تطبيق الفلاتر
          </button>
        </form>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-950">العمليات المسجلة</h3>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">{data?.pagination.totalItems ?? 0}</span>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">جاري تحميل سجل التدقيق...</div>
        ) : data?.items.length ? (
          data.items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-slate-950">{item.actionLabel}</h4>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">{item.entityLabel}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.actor ? `${item.actor.displayName} (@${item.actor.username})` : "عملية نظام"}
                  </p>
                </div>
                <time className="text-xs font-bold text-slate-500">{formatDateTime(item.createdAt)}</time>
              </div>

              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">معرّف الكيان</dt><dd className="mt-1 break-all font-mono text-slate-700" dir="ltr">{item.entityId ?? "—"}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">عنوان IP</dt><dd className="mt-1 font-mono text-slate-700" dir="ltr">{item.ipAddress ?? "—"}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">Request ID</dt><dd className="mt-1 break-all font-mono text-slate-700" dir="ltr">{item.requestId ?? "—"}</dd></div>
              </dl>

              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                <JsonBlock title="القيم السابقة" value={item.oldValues} />
                <JsonBlock title="القيم الجديدة" value={item.newValues} />
                <JsonBlock title="بيانات إضافية" value={item.metadata} />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">لا توجد عمليات مطابقة للفلاتر.</div>
        )}

        {data && data.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <button type="button" disabled={page <= 1 || loading} onClick={() => void load(Math.max(page - 1, 1))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black disabled:opacity-40">السابق</button>
            <span className="text-sm font-black text-slate-700">{data.pagination.page} / {data.pagination.totalPages}</span>
            <button type="button" disabled={page >= data.pagination.totalPages || loading} onClick={() => void load(page + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black disabled:opacity-40">التالي</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
