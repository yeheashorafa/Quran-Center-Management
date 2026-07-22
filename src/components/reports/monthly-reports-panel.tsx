"use client";

import { useMemo, useState } from "react";
import type {
  MonthlyReportOptions,
  ReportFormat,
  ReportKind,
} from "@/lib/reports/types";

type ApiMessage = { message?: string };

function roleText(roleCode: MonthlyReportOptions["roleCode"]): {
  eyebrow: string;
  title: string;
  description: string;
} {
  if (roleCode === "TEACHER") {
    return {
      eyebrow: "تقارير الشيخ",
      title: "التقرير الشهري للحلقات",
      description: "تقرير الحضور والإنجاز والاختبارات للحلقات المعيّن عليها خلال شهر محدد.",
    };
  }
  if (roleCode === "EXAMINER") {
    return {
      eyebrow: "تقارير المختبر",
      title: "تقرير الاختبارات الرسمية",
      description: "تصدير سجل الاختبارات الرسمي حسب الشهر والمرحلة والحلقة.",
    };
  }
  return {
    eyebrow: "تقارير المركز",
    title: "التقارير الشهرية",
    description: "تقرير شامل للمركز أو تقرير مستقل للاختبارات مع تصفية المرحلة والحلقة.",
  };
}

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return fallback;
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i)?.[1];
  return plain || fallback;
}

async function apiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as ApiMessage;
  return data.message || "تعذر إنشاء التقرير.";
}

export function MonthlyReportsPanel({
  options,
  initialMonth,
}: {
  options: MonthlyReportOptions;
  initialMonth: string;
}) {
  const content = roleText(options.roleCode);
  const [month, setMonth] = useState(initialMonth);
  const [kind, setKind] = useState<ReportKind>(options.defaultKind);
  const [stageId, setStageId] = useState("");
  const [halaqaId, setHalaqaId] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const halaqat = useMemo(() => {
    const stages = stageId ? options.stages.filter((stage) => stage.id === stageId) : options.stages;
    return stages.flatMap((stage) => stage.halaqat);
  }, [options.stages, stageId]);

  function changeStage(value: string) {
    setStageId(value);
    setHalaqaId("");
  }

  async function download(format: ReportFormat) {
    if (!month) {
      setNotice({ type: "error", text: "اختر الشهر أولاً." });
      return;
    }

    setBusy(format);
    setNotice(null);
    try {
      const params = new URLSearchParams({
        month,
        kind,
        format,
        includeVoided: includeVoided ? "true" : "false",
      });
      if (stageId && stageId !== "unassigned") params.set("stageId", stageId);
      if (halaqaId) params.set("halaqaId", halaqaId);

      const response = await fetch(`/api/reports/monthly?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await apiError(response));

      const blob = await response.blob();
      const fallback = `تقرير_${month}.${format === "pdf" ? "pdf" : "xml"}`;
      const filename = filenameFromHeader(response.headers.get("content-disposition"), fallback);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice({ type: "success", text: "تم تجهيز التقرير وتنزيله بنجاح." });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "تعذر إنشاء التقرير.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-emerald-700">{content.eyebrow}</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{content.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{content.description}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          Excel + PDF
        </div>
      </div>

      {notice ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="form-label" htmlFor={`report-month-${options.roleCode}`}>الشهر</label>
          <input
            className="form-control"
            id={`report-month-${options.roleCode}`}
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>

        {options.allowedKinds.length > 1 ? (
          <div>
            <label className="form-label" htmlFor="report-kind">نوع التقرير</label>
            <select
              className="form-control"
              id="report-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as ReportKind)}
            >
              <option value="COMPREHENSIVE">التقرير الشامل</option>
              <option value="EXAMS">الاختبارات الرسمية</option>
            </select>
          </div>
        ) : null}

        <div>
          <label className="form-label" htmlFor={`report-stage-${options.roleCode}`}>المرحلة</label>
          <select
            className="form-control"
            id={`report-stage-${options.roleCode}`}
            value={stageId}
            onChange={(event) => changeStage(event.target.value)}
          >
            <option value="">كل المراحل</option>
            {options.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor={`report-halaqa-${options.roleCode}`}>الحلقة</label>
          <select
            className="form-control"
            id={`report-halaqa-${options.roleCode}`}
            value={halaqaId}
            onChange={(event) => setHalaqaId(event.target.value)}
          >
            <option value="">كل الحلقات المتاحة</option>
            {halaqat.map((halaqa) => (
              <option key={halaqa.id} value={halaqa.id}>
                {halaqa.nameAr}{halaqa.teacherName ? ` — ${halaqa.teacherName}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {kind === "EXAMS" && options.roleCode !== "TEACHER" ? (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={includeVoided}
            onChange={(event) => setIncludeVoided(event.target.checked)}
          />
          تضمين الاختبارات الملغاة في التقرير
        </label>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="rounded-2xl bg-emerald-800 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => download("excel")}
        >
          {busy === "excel" ? "جاري تجهيز Excel..." : "📊 تصدير Excel"}
        </button>
        <button
          type="button"
          className="rounded-2xl border-2 border-emerald-800 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => download("csv")}
        >
          {busy === "csv" ? "جاري تجهيز CSV..." : "📄 تصدير CSV (UTF-8)"}
        </button>
        <button
          type="button"
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => download("pdf")}
        >
          {busy === "pdf" ? "جاري تجهيز PDF..." : "🖨️ تصدير PDF"}
        </button>
      </div>

      <p className="mt-3 text-xs leading-6 text-slate-500">
        ملف Excel يُنشأ بصيغة Spreadsheet XML المتوافقة مع Microsoft Excel، وملف PDF يُنشأ على الخادم من قالب عربي جاهز للطباعة.
      </p>
    </section>
  );
}
