"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AppRoleCode } from "@/lib/auth/constants";
import { WEEKDAY_CODES, WEEKDAY_LABELS, type WeekdayCode } from "@/lib/halaqat/weekdays";
import type { ManagerDashboardData } from "@/lib/manager/types";
import { StudentManagementPanel } from "@/components/students/student-management-panel";
import { DailyMonitoringPanel } from "@/components/manager/daily-monitoring-panel";
import type { ManagerDailyMonitoringData } from "@/lib/manager-monitoring/types";

type ActiveTab = "monitoring" | "halaqat" | "students" | "users";

type ApiMessage = {
  message?: string;
};

const ROLE_LABELS: Record<AppRoleCode, string> = {
  TEACHER: "شيخ / محفّظ",
  CENTER_MANAGER: "مدير مركز",
  EXAMINER: "مختبر / ممتحن",
};

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readApiMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as ApiMessage;
  return data.message || (response.ok ? "تمت العملية بنجاح." : "تعذر تنفيذ العملية.");
}

export function ManagementPanel({
  data,
  monitoringData,
  initialTab = "monitoring",
}: {
  data: ManagerDashboardData;
  monitoringData: ManagerDailyMonitoringData;
  initialTab?: ActiveTab;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeTeachers = useMemo(
    () =>
      data.users.filter(
        (user) => user.status === "ACTIVE" && user.roles.some((role) => role.code === "TEACHER"),
      ),
    [data.users],
  );

  const firstStage = data.stages[0];
  const [halaqaStageId, setHalaqaStageId] = useState(firstStage?.id ?? "");
  const [halaqaWeekdays, setHalaqaWeekdays] = useState<WeekdayCode[]>(
    firstStage?.defaultWeekdays ?? [],
  );

  function showResult(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStageChange(stageId: string) {
    setHalaqaStageId(stageId);
    const stage = data.stages.find((item) => item.id === stageId);
    setHalaqaWeekdays(stage?.defaultWeekdays ?? []);
  }

  function toggleWeekday(weekday: WeekdayCode) {
    setHalaqaWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday],
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyKey("create-user");
    setNotice(null);

    try {
      const response = await fetch("/api/manager/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          displayName: formData.get("displayName"),
          password: formData.get("password"),
          role: formData.get("role"),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      form.reset();
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إنشاء المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateUserStatus(userId: string, status: "ACTIVE" | "DISABLED") {
    const key = `user-${userId}`;
    setBusyKey(key);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تحديث المستخدم.");
    } finally {
      setBusyKey(null);
    }
  }

  async function createHalaqa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyKey("create-halaqa");
    setNotice(null);

    try {
      const response = await fetch("/api/manager/halaqat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr: formData.get("nameAr"),
          stageId: halaqaStageId,
          teacherUserId: formData.get("teacherUserId"),
          effectiveFrom: formData.get("effectiveFrom"),
          notes: formData.get("notes"),
          weekdays: halaqaWeekdays,
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      form.reset();
      if (firstStage) handleStageChange(firstStage.id);
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر إنشاء الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateHalaqaStatus(halaqaId: string, status: "ACTIVE" | "INACTIVE") {
    const key = `halaqa-${halaqaId}`;
    setBusyKey(key);
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/halaqat/${halaqaId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);
      showResult("success", message);
      router.refresh();
    } catch (error) {
      showResult("error", error instanceof Error ? error.message : "تعذر تحديث الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryCard value={data.stats.activeStudents} label="طالب نشط" />
        <SummaryCard value={data.stats.activeHalaqat} label="حلقة نشطة" />
        <SummaryCard value={data.stats.activeTeachers} label="شيخ نشط" />
        <SummaryCard value={data.stats.totalUsers} label="مستخدم" />
      </div>

      <div className="grid grid-cols-2 rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm sm:grid-cols-4">
        <TabButton active={activeTab === "monitoring"} onClick={() => setActiveTab("monitoring")}>
          المتابعة
        </TabButton>
        <TabButton active={activeTab === "halaqat"} onClick={() => setActiveTab("halaqat")}>
          الحلقات
        </TabButton>
        <TabButton active={activeTab === "students"} onClick={() => setActiveTab("students")}>
          الطلاب
        </TabButton>
        <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>
          المستخدمون
        </TabButton>
      </div>

      {activeTab === "monitoring" ? (
        <DailyMonitoringPanel initialData={monitoringData} />
      ) : activeTab === "halaqat" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-bold text-emerald-700">إدارة الحلقات</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">إضافة حلقة جديدة</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                يتم ربط الحلقة بالمرحلة والشيخ وأيام الدوام في عملية واحدة.
              </p>
            </div>

            {!activeTeachers.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                أضف مستخدماً بدور الشيخ أولاً قبل إنشاء الحلقة.
              </div>
            ) : null}

            <form className="mt-4 space-y-4" onSubmit={createHalaqa}>
              <div>
                <label className="form-label" htmlFor="halaqa-name">اسم الحلقة</label>
                <input
                  className="form-control"
                  id="halaqa-name"
                  name="nameAr"
                  placeholder="مثال: حلقة أشبال 1"
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="halaqa-stage">المرحلة</label>
                <select
                  className="form-control"
                  id="halaqa-stage"
                  value={halaqaStageId}
                  onChange={(event) => handleStageChange(event.target.value)}
                  required
                >
                  {data.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.nameAr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="halaqa-teacher">الشيخ المسؤول</label>
                <select
                  className="form-control"
                  id="halaqa-teacher"
                  name="teacherUserId"
                  required
                  disabled={!activeTeachers.length}
                >
                  <option value="">-- اختر الشيخ --</option>
                  {activeTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="form-label">أيام الحلقة</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WEEKDAY_CODES.map((weekday) => {
                    const checked = halaqaWeekdays.includes(weekday);
                    return (
                      <label
                        key={weekday}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                          checked
                            ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-emerald-700"
                          checked={checked}
                          onChange={() => toggleWeekday(weekday)}
                        />
                        {WEEKDAY_LABELS[weekday]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label className="form-label" htmlFor="halaqa-start">تاريخ بدء الجدول</label>
                <input
                  className="form-control"
                  id="halaqa-start"
                  name="effectiveFrom"
                  type="date"
                  defaultValue={todayInputValue()}
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="halaqa-notes">ملاحظات</label>
                <textarea
                  className="form-control min-h-24 resize-y"
                  id="halaqa-notes"
                  name="notes"
                  placeholder="اختياري"
                />
              </div>

              <button
                className="min-h-12 w-full rounded-2xl bg-emerald-800 px-4 font-black text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyKey !== null || !activeTeachers.length || !halaqaWeekdays.length}
              >
                {busyKey === "create-halaqa" ? "جاري الإنشاء..." : "إنشاء الحلقة"}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-700">الحلقات المسجلة</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">قائمة الحلقات</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
                {data.halaqat.length}
              </span>
            </div>

            {data.halaqat.length ? data.halaqat.map((halaqa) => (
              <article key={halaqa.id} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">{halaqa.nameAr}</h3>
                      <StatusBadge active={halaqa.status === "ACTIVE"} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{halaqa.code}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-center">
                    <div className="text-lg font-black text-emerald-900">{halaqa.activeStudentsCount}</div>
                    <div className="text-[10px] font-bold text-emerald-700">طالب نشط</div>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <InfoItem label="المرحلة" value={halaqa.stage?.nameAr || "غير محددة"} />
                  <InfoItem label="الشيخ" value={halaqa.primaryTeacher?.displayName || "غير معيّن"} />
                </dl>

                <div className="mt-4">
                  <p className="text-xs font-extrabold text-slate-500">أيام الحلقة</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {halaqa.weekdays.map((weekday) => (
                      <span key={weekday} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {WEEKDAY_LABELS[weekday]}
                      </span>
                    ))}
                  </div>
                </div>

                {halaqa.notes ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{halaqa.notes}</p> : null}

                <button
                  className={`mt-4 min-h-11 w-full rounded-xl border px-4 text-sm font-black transition disabled:opacity-60 ${
                    halaqa.status === "ACTIVE"
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                  disabled={busyKey !== null}
                  onClick={() => updateHalaqaStatus(halaqa.id, halaqa.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                >
                  {busyKey === `halaqa-${halaqa.id}`
                    ? "جاري التحديث..."
                    : halaqa.status === "ACTIVE"
                      ? "إيقاف الحلقة بدون حذف البيانات"
                      : "إعادة تفعيل الحلقة"}
                </button>
              </article>
            )) : (
              <EmptyState text="لم تتم إضافة حلقات بعد." />
            )}
          </section>
        </div>
      ) : activeTab === "students" ? (
        <StudentManagementPanel students={data.students} halaqat={data.studentHalaqat} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold text-emerald-700">إدارة المستخدمين</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">إضافة مستخدم</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              كلمة الدخول تُشفّر في الخادم ولا تُعرض مرة أخرى بعد الحفظ.
            </p>

            <form className="mt-5 space-y-4" onSubmit={createUser}>
              <div>
                <label className="form-label" htmlFor="display-name">الاسم الظاهر</label>
                <input className="form-control" id="display-name" name="displayName" placeholder="مثال: الشيخ أحمد" required />
              </div>
              <div>
                <label className="form-label" htmlFor="username">اسم المستخدم</label>
                <input className="form-control" id="username" name="username" autoComplete="off" placeholder="ahmad" required />
              </div>
              <div>
                <label className="form-label" htmlFor="new-password">كلمة الدخول</label>
                <input
                  className="form-control"
                  id="new-password"
                  name="password"
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="6 خانات على الأقل"
                  required
                />
              </div>
              <div>
                <label className="form-label" htmlFor="user-role">الصلاحية</label>
                <select className="form-control" id="user-role" name="role" defaultValue="TEACHER" required>
                  {Object.entries(ROLE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                className="min-h-12 w-full rounded-2xl bg-emerald-800 px-4 font-black text-white transition hover:bg-emerald-900 disabled:opacity-60"
                disabled={busyKey !== null}
              >
                {busyKey === "create-user" ? "جاري الإنشاء..." : "إنشاء المستخدم"}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-700">الحسابات المسجلة</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">قائمة المستخدمين</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">{data.users.length}</span>
            </div>

            {data.users.map((user) => (
              <article key={user.id} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">{user.displayName}</h3>
                      <StatusBadge active={user.status === "ACTIVE"} label={user.status === "LOCKED" ? "موقوف مؤقتاً" : undefined} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">@{user.username}</p>
                  </div>
                  {user.isCurrentUser ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-900">حسابك</span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <span key={role.code} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      {role.nameAr}
                    </span>
                  ))}
                </div>

                {user.activeHalaqat.length ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-extrabold text-slate-500">الحلقات المرتبطة</p>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-700">
                      {user.activeHalaqat.map((halaqa) => halaqa.nameAr).join("، ")}
                    </p>
                  </div>
                ) : null}

                <button
                  className={`mt-4 min-h-11 w-full rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    user.status === "ACTIVE"
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                  disabled={busyKey !== null || user.isCurrentUser}
                  onClick={() => updateUserStatus(user.id, user.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
                >
                  {busyKey === `user-${user.id}`
                    ? "جاري التحديث..."
                    : user.isCurrentUser
                      ? "لا يمكن إيقاف الحساب الحالي"
                      : user.status === "ACTIVE"
                        ? "إيقاف المستخدم"
                        : "تفعيل المستخدم"}
                </button>
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ value, label }: { value: number; label: string }) {
  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-3 text-center shadow-sm sm:p-4">
      <div className="text-2xl font-black text-emerald-900 sm:text-3xl">{value}</div>
      <div className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">{label}</div>
    </article>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`min-h-11 rounded-xl px-4 text-sm font-black transition ${
        active ? "bg-emerald-800 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
      {label || (active ? "نشط" : "متوقف")}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-[11px] font-extrabold text-slate-500">{label}</dt>
      <dd className="mt-1 font-black text-slate-800">{value}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
