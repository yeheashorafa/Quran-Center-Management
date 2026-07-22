const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "تسجيل دخول ناجح",
  AUTH_LOGIN_FAILED: "محاولة دخول فاشلة",
  LOGOUT: "تسجيل خروج",
  USER_CREATED: "إنشاء مستخدم",
  USER_ACTIVATED: "تفعيل مستخدم",
  USER_DISABLED: "إيقاف مستخدم",
  HALAQA_CREATED: "إنشاء حلقة",
  HALAQA_ACTIVATED: "تفعيل حلقة",
  HALAQA_DISABLED: "إيقاف حلقة",
  STUDENT_CREATED_AND_ENROLLED: "إنشاء طالب وتسجيله",
  STUDENT_PROFILE_UPDATED: "تعديل ملف طالب",
  STUDENT_DEACTIVATED: "إيقاف طالب",
  STUDENT_ACTIVATED: "إعادة تفعيل طالب",
  STUDENT_ENROLLED: "تسجيل طالب في حلقة",
  STUDENT_TRANSFERRED: "نقل طالب",
  MEMORIZATION_SESSION_ITEMS_SAVED: "حفظ سجلات جلسة",
  MEMORIZATION_SESSION_COMPLETED: "اعتماد جلسة تسميع",
  OFFICIAL_EXAM_CREATED: "إنشاء اختبار رسمي",
  OFFICIAL_EXAM_UPDATED: "تعديل اختبار رسمي",
  OFFICIAL_EXAM_VOIDED: "إلغاء اختبار رسمي",
  MONTHLY_REPORT_EXPORTED: "تصدير تقرير شهري",
};

const ENTITY_LABELS: Record<string, string> = {
  auth_session: "جلسة دخول",
  user: "مستخدم",
  halaqa: "حلقة",
  student: "طالب",
  student_enrollment: "تسجيل طالب",
  student_transfer: "نقل طالب",
  memorization_session: "جلسة تسميع",
  session_record_item: "سجل طالب في جلسة",
  official_exam: "اختبار رسمي",
  monthly_report: "تقرير شهري",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType.replaceAll("_", " ");
}
