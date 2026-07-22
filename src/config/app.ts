export const appConfig = {
  name: "تطبيق إدارة مركز تحفيظ قرآن",
  centerName: "مركز سيد الشهداء حمزة",
  description: "نظام آمن وسهل لمتابعة الحلقات والطلاب وإنجاز التحفيظ.",
} as const;

export const stages = [
  { value: "BARAEM", label: "البراعم" },
  { value: "ASHBAL", label: "الأشبال" },
  { value: "NASHIEEN", label: "الناشئين" },
] as const;

export const loginRoles = [
  { value: "TEACHER", label: "المحفّظ", description: "تسجيل التسميع ومتابعة طلاب الحلقة" },
  { value: "CENTER_MANAGER", label: "مدير المركز", description: "إدارة الحلقات والطلاب والتقارير" },
  { value: "EXAMINER", label: "المختبر", description: "تسجيل ومتابعة الاختبارات الرسمية" },
] as const;

export type StageValue = (typeof stages)[number]["value"];
export type LoginRoleValue = (typeof loginRoles)[number]["value"];
