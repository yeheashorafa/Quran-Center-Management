import {
  arabicWeekdayForDate,
  cleanText,
  compactCode,
  dateOnly,
  deterministicUuid,
  isUuid,
  maxDate,
  minDate,
  normalizeArabicName,
  normalizeGroupName,
  parseBoolean,
  parseInteger,
  parseNumber,
  previousDate,
  safeJson,
  stageCodeForGroup,
  timestamp,
  weekdayForDate,
} from "./normalize";
import type {
  LegacyMapPlan,
  LegacyRow,
  LoadedLegacySources,
  MigrationPlan,
  PlanWarning,
  PlannedActivity,
  PlannedEnrollment,
  PlannedExam,
  PlannedHalaqa,
  PlannedSession,
  PlannedSessionItem,
  PlannedStudent,
  PlannedUser,
} from "./types";

const DEFAULT_STAGE_WEEKDAYS: Record<string, string[]> = {
  BRAAIM: ["SUNDAY", "TUESDAY", "THURSDAY"],
  ASHBAL: ["SATURDAY", "MONDAY", "WEDNESDAY"],
  NASHIEEN: ["SATURDAY", "MONDAY", "WEDNESDAY"],
};

const SOURCE_SYSTEM_DEFAULT = "hifz-center-v19";
const NAMESPACE = "quran-center-management/legacy-v1";

type StudentCandidate = {
  source: "students" | "session-only";
  legacyId: string;
  fullName: string;
  normalizedName: string;
  displayName: string;
  parentPhone: string | null;
  gradeLevel: string | null;
  startMonth: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  groupName: string;
  sheikhName: string;
  synthetic: boolean;
};

type HalaqaSeed = {
  key: string;
  groupName: string;
  sheikhName: string;
  normalizedSheikh: string;
  programCode: string;
  stageCode: "BRAAIM" | "ASHBAL" | "NASHIEEN" | null;
  dates: Set<string>;
  weekdays: Set<string>;
};

type EnrollmentAccumulator = {
  key: string;
  studentId: string;
  halaqaId: string;
  programCode: string;
  dates: string[];
  legacyStudentIds: Set<string>;
};

function required(row: LegacyRow, key: string): string {
  return cleanText(row[key]);
}

function roleCode(row: LegacyRow): "TEACHER" | "CENTER_MANAGER" | "EXAMINER" {
  const role = cleanText(row.role).toLowerCase();
  if (role === "examiner" || normalizeArabicName(row.name).includes("مختبر")) return "EXAMINER";
  if (role === "admin" || role === "manager") return "CENTER_MANAGER";
  return "TEACHER";
}

function programCodeForGroup(groupName: string): "BASE_PROGRAM" | "LEGACY_CAMP_2026" {
  return normalizeGroupName(groupName) === "مخيم" ? "LEGACY_CAMP_2026" : "BASE_PROGRAM";
}

function halaqaKey(groupName: string, sheikhName: string): string {
  const group = normalizeGroupName(groupName);
  return `${programCodeForGroup(group)}|${group}|${normalizeArabicName(sheikhName)}`;
}

function attendanceStatus(value: string): PlannedSessionItem["attendance"] {
  const normalized = normalizeArabicName(value);
  if (normalized === "حضر" || normalized === "حضور") return "PRESENT";
  if (normalized === "غياب" || normalized === "غائب") return "ABSENT";
  if (["اذن", "عذر", "ماذون"].includes(normalized)) return "EXCUSED";
  if (normalized.includes("لم يسمع")) return "NOT_HEARD";
  return "PENDING";
}

function activityTypeForColumn(column: string): PlannedActivity["type"] {
  if (column === "review") return "REVIEW";
  if (column === "recitation") return "RECITATION";
  return "MEMORIZATION";
}

function normalizeActivityObjects(row: LegacyRow, column: "memorization" | "review" | "recitation"): Record<string, unknown>[] {
  let parsed = safeJson<unknown>(row[column], []);
  if ((!Array.isArray(parsed) || parsed.length === 0) && column === "memorization") {
    parsed = safeJson<unknown>(row.surahs, []);
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function buildActivities(row: LegacyRow, itemId: string): PlannedActivity[] {
  const activities: PlannedActivity[] = [];
  for (const column of ["memorization", "review", "recitation"] as const) {
    const type = activityTypeForColumn(column);
    const objects = normalizeActivityObjects(row, column);
    const fallbackPages = parseNumber(row[`${column}_pages`]) ?? 0;

    objects.forEach((activity, index) => {
      const fromAyah = parseInteger(activity.from_ayah ?? activity.ayah_from ?? activity.from);
      const toAyah = parseInteger(activity.to_ayah ?? activity.ayah_to ?? activity.to);
      const pageCount = parseNumber(activity.pages) ?? (objects.length === 1 ? fallbackPages : 0) ?? 0;
      activities.push({
        id: deterministicUuid(NAMESPACE, `activity:${itemId}:${type}:${index + 1}`),
        type,
        orderNo: index + 1,
        surahName: cleanText(activity.name) || null,
        fromAyah,
        toAyah,
        pageCount: Math.max(0, pageCount),
        details: { ...activity, legacyColumn: column },
      });
    });

    if (objects.length === 0 && fallbackPages > 0) {
      activities.push({
        id: deterministicUuid(NAMESPACE, `activity:${itemId}:${type}:fallback`),
        type,
        orderNo: 1,
        surahName: null,
        fromAyah: null,
        toAyah: null,
        pageCount: fallbackPages,
        details: { legacyColumn: column, inferredFromAggregate: true },
      });
    }
  }
  return activities;
}

function parseSessionFallbackRows(sessionRows: LegacyRow[], existingKeys: Set<string>, warnings: PlanWarning[]): LegacyRow[] {
  const rows: LegacyRow[] = [];
  for (const session of sessionRows) {
    const groupName = normalizeGroupName(session.group_name);
    const sheikhName = cleanText(session.sheikh_name);
    const sessionDate = dateOnly(session.session_date);
    if (!groupName || !sheikhName || !sessionDate) continue;
    const key = `${halaqaKey(groupName, sheikhName)}|${sessionDate}`;
    if (existingKeys.has(key)) continue;

    const records = safeJson<unknown>(session.records, []);
    if (!Array.isArray(records)) {
      warnings.push({
        code: "INVALID_SESSIONS_JSON",
        severity: "WARNING",
        message: "تعذر قراءة records من جدول sessions الاحتياطي.",
        sourceFile: "sessions_rows.csv",
        legacyId: session.id,
      });
      continue;
    }

    records.forEach((record, index) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return;
      const candidate = record as Record<string, unknown>;
      rows.push({
        id: `${session.id || key}:record:${index + 1}`,
        group_name: groupName,
        sheikh_name: sheikhName,
        session_date: sessionDate,
        session_day: cleanText(session.session_day) || arabicWeekdayForDate(sessionDate),
        student_name: cleanText(candidate.student_name ?? candidate.name),
        student_order: String(index + 1),
        status: cleanText(candidate.status),
        achievement: cleanText(candidate.achievement),
        note: cleanText(candidate.note),
        student_id: cleanText(candidate.student_id),
        memorization: JSON.stringify(candidate.memorization ?? candidate.surahs ?? []),
        review: JSON.stringify(candidate.review ?? []),
        recitation: JSON.stringify(candidate.recitation ?? []),
        memorization_pages: String(candidate.memorization_pages ?? 0),
        review_pages: String(candidate.review_pages ?? 0),
        recitation_pages: String(candidate.recitation_pages ?? 0),
        total_pages: String(candidate.total_pages ?? 0),
        record_version: cleanText(candidate.record_version),
        created_at: session.created_at,
        updated_at: session.created_at,
        _legacy_session_id: session.id,
        _fallback_source: "true",
      });
    });
  }
  return rows;
}

function juzNumber(value: unknown): number | null {
  const direct = parseInteger(value);
  if (direct && direct >= 1 && direct <= 30) return direct;
  const text = normalizeArabicName(value);
  const words: Record<string, number> = {
    الاول: 1, الثاني: 2, الثالث: 3, الرابع: 4, الخامس: 5, السادس: 6, السابع: 7, الثامن: 8, التاسع: 9, العاشر: 10,
    الحاديعشر: 11, الثانيعشر: 12, الثالثعشر: 13, الرابععشر: 14, الخامسعشر: 15, السادسعشر: 16, السابععشر: 17,
    الثامنعشر: 18, التاسععشر: 19, العشرون: 20, الواحدوالعشرون: 21, الثانيوالعشرون: 22, الثالثوالعشرون: 23,
    الرابعوالعشرون: 24, الخامسوالعشرون: 25, السادسوالعشرون: 26, السابعوالعشرون: 27, الثامنوالعشرون: 28,
    التاسعوالعشرون: 29, الثلاثون: 30,
  };
  const compact = text.replace(/\s+/g, "").replace(/^الجزء/, "");
  return words[compact] ?? null;
}

export function buildMigrationPlan(
  sources: LoadedLegacySources,
  sourceSystem = SOURCE_SYSTEM_DEFAULT,
): MigrationPlan {
  const warnings: PlanWarning[] = [];
  const legacyMaps: LegacyMapPlan[] = [];
  for (const missingFile of sources.missingOptionalFiles) {
    warnings.push({
      code: "OPTIONAL_SOURCE_FILE_MISSING",
      severity: "INFO",
      message: `الملف الاختياري غير موجود ولن تُستورد بياناته: ${missingFile}.`,
      sourceFile: missingFile,
    });
  }
  const teachers = sources.files["teachers_rows.csv"] ?? [];
  const campTeachers = sources.files["camp_teachers_rows.csv"] ?? [];
  const studentRows = sources.files["students_rows.csv"] ?? [];
  const primarySessionRows = sources.files["session_records_rows.csv"] ?? [];
  const sessionsFallback = sources.files["sessions_rows.csv"] ?? [];
  const officialExamRows = sources.files["official_exams_rows.csv"] ?? [];
  const simpleExamRows = sources.files["exams_rows.csv"] ?? [];

  const sessionKeys = new Set(
    primarySessionRows.map((row) => {
      const date = dateOnly(row.session_date) ?? "";
      return `${halaqaKey(row.group_name, row.sheikh_name)}|${date}`;
    }),
  );
  const fallbackSessionIdByKey = new Map<string, string>(
    sessionsFallback.flatMap((row) => {
      const sessionDate = dateOnly(row.session_date);
      const legacyId = cleanText(row.id);
      if (!sessionDate || !legacyId) return [];
      return [[`${halaqaKey(row.group_name, row.sheikh_name)}|${sessionDate}`, legacyId] as const];
    }),
  );
  const fallbackRows = parseSessionFallbackRows(sessionsFallback, sessionKeys, warnings);
  const allSessionRows = [...primarySessionRows, ...fallbackRows];

  // Users are deduplicated by normalized display name. Legacy PIN/password values are deliberately ignored.
  const usersByName = new Map<string, PlannedUser>();
  const allTeacherRows = [
    ...teachers.map((row) => ({ row, entityType: "teacher" as const })),
    ...campTeachers.map((row) => ({ row, entityType: "camp_teacher" as const })),
  ];

  const ensureUser = (nameValue: unknown, role: PlannedUser["roleCodes"][number], legacyId?: string, entityType: "teacher" | "camp_teacher" = "teacher") => {
    const displayName = cleanText(nameValue);
    const normalized = normalizeArabicName(displayName);
    if (!normalized) return null;
    let user = usersByName.get(normalized);
    if (!user) {
      const id = deterministicUuid(NAMESPACE, `user:${normalized}`);
      const username = `legacy-${compactCode(normalized).toLowerCase()}`;
      user = {
        id,
        displayName,
        username,
        normalizedUsername: username,
        roleCodes: [],
        status: "DISABLED",
        legacyIds: [],
      };
      usersByName.set(normalized, user);
    }
    if (!user.roleCodes.includes(role)) user.roleCodes.push(role);
    if (legacyId && !user.legacyIds.some((item) => item.entityType === entityType && item.legacyId === legacyId)) {
      user.legacyIds.push({ entityType, legacyId });
      legacyMaps.push({ entityType, legacyId, plannedNewId: user.id, canonicalKey: normalized });
    }
    return user;
  };

  for (const { row, entityType } of allTeacherRows) {
    const user = ensureUser(row.name, entityType === "teacher" ? roleCode(row) : "TEACHER", row.id, entityType);
    if (!user) {
      warnings.push({ code: "TEACHER_WITHOUT_NAME", severity: "ERROR", message: "صف شيخ بدون اسم ولن يُرحّل.", sourceFile: entityType === "teacher" ? "teachers_rows.csv" : "camp_teachers_rows.csv", legacyId: row.id });
    }
  }

  // Also preserve sheikhs referenced by students/sessions even if they are missing from teachers export.
  for (const row of [...studentRows, ...allSessionRows]) {
    const sheikhName = cleanText(row.sheikh_name);
    if (sheikhName) ensureUser(sheikhName, "TEACHER");
  }
  for (const row of officialExamRows) ensureUser(row.examiner_name || "المختبر القديم", "EXAMINER");
  if (simpleExamRows.length) ensureUser("المختبر القديم", "EXAMINER");

  const campOriginalGroupByTeacher = new Map(
    campTeachers.map((row) => [normalizeArabicName(row.name), normalizeGroupName(row.original_group)]),
  );

  const halaqaSeeds = new Map<string, HalaqaSeed>();
  const ensureHalaqaSeed = (groupValue: unknown, sheikhValue: unknown, observedDate?: string | null) => {
    const groupName = normalizeGroupName(groupValue);
    const sheikhName = cleanText(sheikhValue);
    if (!groupName || !sheikhName) return null;
    const key = halaqaKey(groupName, sheikhName);
    let seed = halaqaSeeds.get(key);
    if (!seed) {
      const normalizedSheikh = normalizeArabicName(sheikhName);
      const inferredStageGroup = groupName === "مخيم" ? campOriginalGroupByTeacher.get(normalizedSheikh) ?? "" : groupName;
      seed = {
        key,
        groupName,
        sheikhName,
        normalizedSheikh,
        programCode: programCodeForGroup(groupName),
        stageCode: stageCodeForGroup(inferredStageGroup),
        dates: new Set(),
        weekdays: new Set(),
      };
      halaqaSeeds.set(key, seed);
    }
    if (observedDate) {
      seed.dates.add(observedDate);
      seed.weekdays.add(weekdayForDate(observedDate));
    }
    return seed;
  };

  for (const row of studentRows) ensureHalaqaSeed(row.group_name, row.sheikh_name);
  for (const row of allSessionRows) ensureHalaqaSeed(row.group_name, row.sheikh_name, dateOnly(row.session_date));
  for (const row of [...officialExamRows, ...simpleExamRows]) ensureHalaqaSeed(row.group_name, row.sheikh_name);

  const allDates = [
    ...studentRows.flatMap((row) => [dateOnly(row.created_at), dateOnly(row.updated_at)]),
    ...allSessionRows.map((row) => dateOnly(row.session_date)),
    ...officialExamRows.map((row) => dateOnly(row.exam_date)),
    ...simpleExamRows.map((row) => dateOnly(row.exam_date)),
  ];
  const fromDate = minDate(allDates);
  const toDate = maxDate(allDates);
  const campDates = allSessionRows.filter((row) => normalizeGroupName(row.group_name) === "مخيم").map((row) => dateOnly(row.session_date));
  const campFrom = minDate(campDates) ?? fromDate;
  const campTo = maxDate(campDates) ?? toDate;

  const programs = [
    {
      id: deterministicUuid(NAMESPACE, "program:BASE_PROGRAM"),
      code: "BASE_PROGRAM",
      nameAr: "البرنامج الأساسي",
      type: "BASE" as const,
      status: "ACTIVE" as const,
      startsOn: null,
      endsOn: null,
    },
    {
      id: deterministicUuid(NAMESPACE, "program:LEGACY_CAMP_2026"),
      code: "LEGACY_CAMP_2026",
      nameAr: "المخيم الصيفي 2026 (أرشيف)",
      type: "SEASONAL" as const,
      status: "ARCHIVED" as const,
      startsOn: campFrom,
      endsOn: campTo,
    },
  ];

  const halaqat: PlannedHalaqa[] = Array.from(halaqaSeeds.values()).map((seed) => {
    const id = deterministicUuid(NAMESPACE, `halaqa:${seed.key}`);
    const firstObservedOn = minDate(Array.from(seed.dates)) ?? fromDate ?? "2026-01-01";
    const lastObservedOn = maxDate(Array.from(seed.dates));
    const observedWeekdays = seed.programCode === "BASE_PROGRAM" && seed.stageCode
      ? DEFAULT_STAGE_WEEKDAYS[seed.stageCode]
      : seed.weekdays.size
        ? Array.from(seed.weekdays).sort()
        : seed.stageCode
          ? DEFAULT_STAGE_WEEKDAYS[seed.stageCode]
          : [];
    return {
      id,
      code: `LEGACY-${seed.programCode === "BASE_PROGRAM" ? "BASE" : "CAMP"}-${compactCode(seed.key)}`,
      nameAr: seed.groupName === "مخيم" ? `مخيم 2026 - ${seed.sheikhName}` : `${seed.groupName} - ${seed.sheikhName}`,
      programCode: seed.programCode,
      stageCode: seed.stageCode,
      status: seed.programCode === "BASE_PROGRAM" ? "ACTIVE" : "ARCHIVED",
      sheikhNormalizedName: seed.normalizedSheikh,
      sourceGroupName: seed.groupName,
      sourceSheikhName: seed.sheikhName,
      observedWeekdays,
      firstObservedOn,
      lastObservedOn,
    };
  });
  const halaqaByKey = new Map(halaqat.map((halaqa) => [halaqaKey(halaqa.sourceGroupName, halaqa.sourceSheikhName), halaqa]));

  const staffAssignments = halaqat.flatMap((halaqa) => {
    const user = usersByName.get(halaqa.sheikhNormalizedName);
    if (!user) {
      warnings.push({ code: "HALAQA_WITHOUT_TEACHER", severity: "ERROR", message: `تعذر ربط شيخ الحلقة ${halaqa.nameAr}.`, details: { halaqaId: halaqa.id } });
      return [];
    }
    return [{
      id: deterministicUuid(NAMESPACE, `assignment:${halaqa.id}:${user.id}`),
      halaqaId: halaqa.id,
      plannedUserId: user.id,
      role: "PRIMARY_TEACHER" as const,
      startsOn: halaqa.firstObservedOn,
      endsOn: halaqa.status === "ARCHIVED" ? halaqa.lastObservedOn : null,
    }];
  });
  const assignmentByHalaqa = new Map(staffAssignments.map((assignment) => [assignment.halaqaId, assignment]));

  const candidates: StudentCandidate[] = [];
  for (const row of studentRows) {
    const fullName = cleanText(row.full_name || row.student_name);
    const normalizedName = normalizeArabicName(fullName);
    if (!normalizedName) {
      warnings.push({
        code: "EMPTY_STUDENT_NAME",
        severity: "ERROR",
        message: "صف طالب بدون اسم تم استبعاده ويحتاج مراجعة يدوية.",
        sourceFile: "students_rows.csv",
        legacyId: row.id,
        details: { groupName: row.group_name, sheikhName: cleanText(row.sheikh_name) },
      });
      continue;
    }
    candidates.push({
      source: "students",
      legacyId: required(row, "id") || deterministicUuid(NAMESPACE, `student-row:${normalizedName}:${candidates.length}`),
      fullName,
      normalizedName,
      displayName: cleanText(row.display_name) || fullName,
      parentPhone: cleanText(row.parent_phone) || null,
      gradeLevel: cleanText(row.grade_level) || null,
      startMonth: dateOnly(row.start_month),
      notes: cleanText(row.notes) || null,
      isActive: parseBoolean(row.is_active, true),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at, timestamp(row.created_at)),
      groupName: normalizeGroupName(row.group_name),
      sheikhName: cleanText(row.sheikh_name),
      synthetic: false,
    });
  }

  const candidateByLegacyId = new Map(candidates.map((candidate) => [candidate.legacyId, candidate]));
  const candidatesByName = new Map<string, StudentCandidate[]>();
  for (const candidate of candidates) {
    const group = candidatesByName.get(candidate.normalizedName) ?? [];
    group.push(candidate);
    candidatesByName.set(candidate.normalizedName, group);
  }

  // Add students found only in session rows. Existing names/legacy ids are resolved later.
  for (const row of allSessionRows) {
    const legacyId = cleanText(row.student_id);
    const fullName = cleanText(row.student_name);
    const normalizedName = normalizeArabicName(fullName);
    if (!normalizedName) {
      warnings.push({ code: "SESSION_RECORD_WITHOUT_STUDENT", severity: "ERROR", message: "سجل جلسة بدون اسم طالب.", sourceFile: row._fallback_source ? "sessions_rows.csv" : "session_records_rows.csv", legacyId: row.id });
      continue;
    }
    if (legacyId && candidateByLegacyId.has(legacyId)) continue;
    if ((candidatesByName.get(normalizedName)?.length ?? 0) === 1) continue;
    const syntheticLegacyId = legacyId || `session-name:${normalizedName}`;
    if (candidateByLegacyId.has(syntheticLegacyId)) continue;
    const synthetic: StudentCandidate = {
      source: "session-only",
      legacyId: syntheticLegacyId,
      fullName,
      normalizedName,
      displayName: fullName,
      parentPhone: null,
      gradeLevel: null,
      startMonth: dateOnly(row.session_date),
      notes: "تم إنشاء الملف تلقائياً من سجل جلسة قديم لعدم وجود صف مطابق في students_rows.csv.",
      isActive: true,
      createdAt: timestamp(row.created_at, `${row.session_date}T00:00:00.000Z`),
      updatedAt: timestamp(row.updated_at, timestamp(row.created_at, `${row.session_date}T00:00:00.000Z`)),
      groupName: normalizeGroupName(row.group_name),
      sheikhName: cleanText(row.sheikh_name),
      synthetic: true,
    };
    candidates.push(synthetic);
    candidateByLegacyId.set(syntheticLegacyId, synthetic);
    const nameGroup = candidatesByName.get(normalizedName) ?? [];
    nameGroup.push(synthetic);
    candidatesByName.set(normalizedName, nameGroup);
    warnings.push({ code: "SYNTHETIC_STUDENT", severity: "WARNING", message: `تم إنشاء طالب من الجلسات فقط: ${fullName}.`, legacyId: syntheticLegacyId });
  }

  const studentByCandidateId = new Map<string, PlannedStudent>();
  const plannedStudents: PlannedStudent[] = [];
  for (const [normalizedName, group] of candidatesByName.entries()) {
    const realRows = group.filter((candidate) => candidate.source === "students");
    const baseRows = realRows.filter((candidate) => programCodeForGroup(candidate.groupName) === "BASE_PROGRAM");
    const seasonalRows = realRows.filter((candidate) => programCodeForGroup(candidate.groupName) !== "BASE_PROGRAM");
    const safeToMerge = group.length === 1 || (baseRows.length <= 1 && seasonalRows.length >= 1) || realRows.length === 0;

    const partitions = safeToMerge ? [group] : group.map((candidate) => [candidate]);
    if (!safeToMerge) {
      warnings.push({
        code: "AMBIGUOUS_DUPLICATE_STUDENT_NAME",
        severity: "ERROR",
        message: `الاسم مكرر داخل البرنامج الأساسي ولن يُدمج تلقائياً: ${group[0]?.fullName ?? normalizedName}.`,
        details: { legacyIds: group.map((candidate) => candidate.legacyId), halaqat: group.map((candidate) => `${candidate.groupName}/${candidate.sheikhName}`) },
      });
    } else if (group.length > 1) {
      warnings.push({
        code: "MERGED_BASE_AND_CAMP_STUDENT",
        severity: "INFO",
        message: `تم دمج سجلات البرنامج الأساسي والمخيم للطالب ${group[0]?.fullName ?? normalizedName}.`,
        details: { legacyIds: group.map((candidate) => candidate.legacyId) },
      });
    }

    partitions.forEach((partition, partitionIndex) => {
      const preferred = partition.find((candidate) => programCodeForGroup(candidate.groupName) === "BASE_PROGRAM") ?? partition[0];
      if (!preferred) return;
      const stableKey = safeToMerge ? normalizedName : `${normalizedName}:${preferred.legacyId}:${partitionIndex}`;
      const preferredUuid = partition.map((candidate) => candidate.legacyId).find(isUuid);
      const id = preferredUuid ?? deterministicUuid(NAMESPACE, `student:${stableKey}`);
      const student: PlannedStudent = {
        id,
        fullName: preferred.fullName,
        normalizedFullName: normalizedName,
        displayName: partition.find((candidate) => candidate.displayName)?.displayName ?? preferred.fullName,
        parentPhone: partition.find((candidate) => candidate.parentPhone)?.parentPhone ?? null,
        gradeLevel: partition.find((candidate) => candidate.gradeLevel)?.gradeLevel ?? null,
        memorizationStartedOn: minDate(partition.map((candidate) => candidate.startMonth)),
        notes: Array.from(new Set(partition.map((candidate) => candidate.notes).filter(Boolean))).join("\n") || null,
        isActive: partition.some((candidate) => candidate.isActive),
        createdAt: partition.map((candidate) => candidate.createdAt).sort()[0] ?? new Date().toISOString(),
        updatedAt: partition.map((candidate) => candidate.updatedAt).sort().at(-1) ?? new Date().toISOString(),
        synthetic: partition.every((candidate) => candidate.synthetic),
        legacyIds: partition.map((candidate) => candidate.legacyId),
      };
      plannedStudents.push(student);
      for (const candidate of partition) {
        studentByCandidateId.set(candidate.legacyId, student);
        legacyMaps.push({
          entityType: candidate.source === "students" ? "student" : "session_student_reference",
          legacyId: candidate.legacyId,
          plannedNewId: student.id,
          canonicalKey: student.normalizedFullName,
          metadata: { mergedLegacyIds: student.legacyIds, synthetic: student.synthetic },
        });
      }
    });
  }

  const studentsByNormalizedName = new Map<string, PlannedStudent[]>();
  for (const student of plannedStudents) {
    const group = studentsByNormalizedName.get(student.normalizedFullName) ?? [];
    group.push(student);
    studentsByNormalizedName.set(student.normalizedFullName, group);
  }

  const resolveStudent = (row: LegacyRow): PlannedStudent | null => {
    const legacyId = cleanText(row.student_id || row.id);
    if (legacyId && studentByCandidateId.has(legacyId)) return studentByCandidateId.get(legacyId) ?? null;
    const normalizedName = normalizeArabicName(row.student_name || row.full_name);
    const matches = studentsByNormalizedName.get(normalizedName) ?? [];
    if (matches.length === 1) return matches[0] ?? null;
    return null;
  };

  const enrollmentAccumulators = new Map<string, EnrollmentAccumulator>();
  const ensureEnrollment = (student: PlannedStudent, groupName: string, sheikhName: string, date: string | null, legacyStudentId?: string) => {
    const halaqa = halaqaByKey.get(halaqaKey(groupName, sheikhName));
    if (!halaqa) return null;
    const key = `${student.id}|${halaqa.id}`;
    let accumulator = enrollmentAccumulators.get(key);
    if (!accumulator) {
      accumulator = { key, studentId: student.id, halaqaId: halaqa.id, programCode: halaqa.programCode, dates: [], legacyStudentIds: new Set() };
      enrollmentAccumulators.set(key, accumulator);
    }
    if (date) accumulator.dates.push(date);
    if (legacyStudentId) accumulator.legacyStudentIds.add(legacyStudentId);
    return accumulator;
  };

  for (const candidate of candidates) {
    const student = studentByCandidateId.get(candidate.legacyId);
    if (!student) continue;
    ensureEnrollment(student, candidate.groupName, candidate.sheikhName, dateOnly(candidate.createdAt), candidate.legacyId);
  }
  for (const row of allSessionRows) {
    const student = resolveStudent(row);
    if (!student) continue;
    ensureEnrollment(student, normalizeGroupName(row.group_name), cleanText(row.sheikh_name), dateOnly(row.session_date), cleanText(row.student_id));
  }
  for (const row of [...officialExamRows, ...simpleExamRows]) {
    const student = resolveStudent(row);
    if (!student) continue;
    ensureEnrollment(student, normalizeGroupName(row.group_name), cleanText(row.sheikh_name), dateOnly(row.exam_date), cleanText(row.student_id));
  }

  const enrollments: PlannedEnrollment[] = Array.from(enrollmentAccumulators.values()).map((accumulator) => {
    const halaqa = halaqat.find((candidate) => candidate.id === accumulator.halaqaId);
    const startedOn = minDate(accumulator.dates) ?? fromDate ?? "2026-01-01";
    const seasonal = accumulator.programCode === "LEGACY_CAMP_2026";
    const endedOn = seasonal ? (maxDate(accumulator.dates) ?? campTo) : null;
    const id = deterministicUuid(NAMESPACE, `enrollment:${accumulator.key}:${startedOn}`);
    for (const legacyStudentId of accumulator.legacyStudentIds) {
      if (!legacyStudentId) continue;
      legacyMaps.push({ entityType: "student_enrollment", legacyId: `${legacyStudentId}:${halaqa?.sourceGroupName ?? ""}:${halaqa?.sourceSheikhName ?? ""}`, plannedNewId: id, canonicalKey: accumulator.key });
    }
    return {
      id,
      studentId: accumulator.studentId,
      halaqaId: accumulator.halaqaId,
      programCode: accumulator.programCode,
      status: seasonal ? "COMPLETED" : "ACTIVE",
      startedOn,
      endedOn,
      endReason: seasonal ? "انتهاء المخيم الموسمي القديم" : null,
      legacyStudentIds: Array.from(accumulator.legacyStudentIds),
    };
  });
  const baseEnrollmentGroups = new Map<string, PlannedEnrollment[]>();
  for (const enrollment of enrollments) {
    if (enrollment.programCode !== "BASE_PROGRAM") continue;
    const group = baseEnrollmentGroups.get(enrollment.studentId) ?? [];
    group.push(enrollment);
    baseEnrollmentGroups.set(enrollment.studentId, group);
  }
  for (const [studentId, group] of baseEnrollmentGroups.entries()) {
    if (group.length <= 1) continue;
    group.sort((left, right) => left.startedOn.localeCompare(right.startedOn));
    warnings.push({
      code: "INFERRED_BASE_ENROLLMENT_TIMELINE",
      severity: "WARNING",
      message: "للطالب أكثر من حلقة في البرنامج الأساسي؛ تم تحويل التسجيلات السابقة إلى تاريخية حسب تاريخ البداية.",
      details: { studentId, enrollmentIds: group.map((enrollment) => enrollment.id) },
    });
    for (let index = 0; index < group.length - 1; index += 1) {
      const current = group[index]!;
      const next = group[index + 1]!;
      const inferredEnd = previousDate(next.startedOn);
      current.status = "INACTIVE";
      current.endedOn = inferredEnd < current.startedOn ? current.startedOn : inferredEnd;
      current.endReason = "إغلاق تاريخي مستنتج أثناء ترحيل بيانات النظام القديم";
    }
  }

  const enrollmentByStudentHalaqa = new Map(enrollments.map((enrollment) => [`${enrollment.studentId}|${enrollment.halaqaId}`, enrollment]));

  const sessionRowsByKey = new Map<string, LegacyRow[]>();
  for (const row of allSessionRows) {
    const sessionDate = dateOnly(row.session_date);
    if (!sessionDate) {
      warnings.push({ code: "INVALID_SESSION_DATE", severity: "ERROR", message: "سجل جلسة بتاريخ غير صالح.", legacyId: row.id, details: { value: row.session_date } });
      continue;
    }
    const key = `${halaqaKey(row.group_name, row.sheikh_name)}|${sessionDate}`;
    const group = sessionRowsByKey.get(key) ?? [];
    group.push(row);
    sessionRowsByKey.set(key, group);
  }

  const sessions: PlannedSession[] = [];
  for (const [key, rows] of sessionRowsByKey.entries()) {
    const first = rows[0];
    if (!first) continue;
    const sessionDate = dateOnly(first.session_date);
    const halaqa = halaqaByKey.get(halaqaKey(first.group_name, first.sheikh_name));
    if (!sessionDate || !halaqa) continue;
    const sessionId = deterministicUuid(NAMESPACE, `session:${halaqa.id}:${sessionDate}`);
    const items: PlannedSessionItem[] = [];
    const seenStudents = new Set<string>();

    for (const row of rows.sort((left, right) => (parseInteger(left.student_order) ?? 9999) - (parseInteger(right.student_order) ?? 9999))) {
      const student = resolveStudent(row);
      if (!student) {
        warnings.push({
          code: "UNRESOLVED_SESSION_STUDENT",
          severity: "ERROR",
          message: `تعذر ربط طالب جلسة: ${cleanText(row.student_name) || "بدون اسم"}.`,
          sourceFile: row._fallback_source ? "sessions_rows.csv" : "session_records_rows.csv",
          legacyId: row.id,
          details: { studentId: row.student_id, groupName: row.group_name, sheikhName: cleanText(row.sheikh_name), sessionDate },
        });
        continue;
      }
      if (seenStudents.has(student.id)) {
        warnings.push({ code: "DUPLICATE_SESSION_STUDENT", severity: "ERROR", message: `تكرر الطالب ${student.fullName} داخل الجلسة نفسها، وتم الاحتفاظ بأول سجل.`, legacyId: row.id, details: { sessionDate, halaqaId: halaqa.id } });
        continue;
      }
      seenStudents.add(student.id);
      const itemId = deterministicUuid(NAMESPACE, `session-item:${sessionId}:${student.id}`);
      const enrollment = enrollmentByStudentHalaqa.get(`${student.id}|${halaqa.id}`) ?? null;
      const status = attendanceStatus(row.status);
      const notes = [cleanText(row.note), cleanText(row.achievement) && buildActivities(row, itemId).length === 0 ? cleanText(row.achievement) : ""]
        .filter(Boolean)
        .join("\n") || null;
      const activities = buildActivities(row, itemId);
      items.push({
        id: itemId,
        studentId: student.id,
        enrollmentId: enrollment?.id ?? null,
        attendance: status,
        notes,
        legacyRecordId: cleanText(row.id) || `${key}:${student.id}`,
        activities,
      });
      legacyMaps.push({ entityType: "session_record", legacyId: cleanText(row.id) || `${key}:${student.id}`, plannedNewId: itemId, canonicalKey: `${sessionId}|${student.id}` });

      const suppliedDay = cleanText(row.session_day);
      const actualDay = arabicWeekdayForDate(sessionDate);
      if (suppliedDay && normalizeArabicName(suppliedDay) !== normalizeArabicName(actualDay)) {
        warnings.push({
          code: "SESSION_DAY_DATE_MISMATCH",
          severity: "WARNING",
          message: `اليوم القديم (${suppliedDay}) لا يطابق التاريخ؛ تم اعتماد اليوم المحسوب (${actualDay}).`,
          sourceFile: row._fallback_source ? "sessions_rows.csv" : "session_records_rows.csv",
          legacyId: row.id,
          details: { sessionDate, suppliedDay, calculatedDay: actualDay },
        });
      }
    }

    const completed = items.length > 0 && items.every((item) => item.attendance !== "PENDING");
    const createdAt = rows.map((row) => timestamp(row.created_at, `${sessionDate}T00:00:00.000Z`)).sort()[0] ?? `${sessionDate}T00:00:00.000Z`;
    const updatedAt = rows.map((row) => timestamp(row.updated_at, timestamp(row.created_at, `${sessionDate}T00:00:00.000Z`))).sort().at(-1) ?? createdAt;
    const legacySessionId = rows.map((row) => cleanText(row._legacy_session_id)).find(Boolean) ?? fallbackSessionIdByKey.get(key) ?? null;
    sessions.push({
      id: sessionId,
      halaqaId: halaqa.id,
      assignmentId: assignmentByHalaqa.get(halaqa.id)?.id ?? null,
      sessionDate,
      status: completed ? "COMPLETED" : "DRAFT",
      notes: "مرحّل من النظام القديم. تم احتساب يوم الجلسة من التاريخ، واعتُمد session_records كمصدر أساسي.",
      createdAt,
      updatedAt,
      completedAt: completed ? updatedAt : null,
      legacySessionId,
      items,
    });
    if (legacySessionId) legacyMaps.push({ entityType: "session", legacyId: legacySessionId, plannedNewId: sessionId, canonicalKey: `${halaqa.id}|${sessionDate}` });
  }

  const defaultExaminer = Array.from(usersByName.values()).find((user) => user.roleCodes.includes("EXAMINER")) ?? ensureUser("المختبر القديم", "EXAMINER");
  const exams: PlannedExam[] = [];
  const buildExam = (row: LegacyRow, entityType: "exam" | "official_exam") => {
    const student = resolveStudent(row);
    const examDate = dateOnly(row.exam_date);
    const halaqa = halaqaByKey.get(halaqaKey(row.group_name, row.sheikh_name));
    if (!student || !examDate || !halaqa || !defaultExaminer) {
      warnings.push({ code: "UNRESOLVED_EXAM", severity: "ERROR", message: `تعذر ربط اختبار قديم للطالب ${cleanText(row.student_name)}.`, sourceFile: entityType === "exam" ? "exams_rows.csv" : "official_exams_rows.csv", legacyId: row.id });
      return;
    }
    const examiner = entityType === "official_exam" ? ensureUser(row.examiner_name || defaultExaminer.displayName, "EXAMINER") ?? defaultExaminer : defaultExaminer;
    const enrollment = enrollmentByStudentHalaqa.get(`${student.id}|${halaqa.id}`) ?? null;
    const typeText = normalizeArabicName(row.exam_type);
    const examType: PlannedExam["examType"] = typeText.includes("مجتمع") || typeText.includes("collective") ? "COLLECTIVE" : typeText.includes("منفرد") || typeText.includes("individual") ? "INDIVIDUAL" : "CUSTOM";
    const legacyId = cleanText(row.id) || deterministicUuid(NAMESPACE, `legacy-exam:${student.id}:${examDate}:${entityType}:${exams.length}`);
    const id = isUuid(legacyId) ? legacyId : deterministicUuid(NAMESPACE, `${entityType}:${legacyId}`);
    const scopes: PlannedExam["scopes"] = [];

    if (entityType === "official_exam") {
      const parts = safeJson<unknown>(row.parts, []);
      const partValues = Array.isArray(parts) ? parts : [];
      const numbers = partValues.map(juzNumber).filter((value): value is number => value != null);
      if (numbers.length) {
        scopes.push({ id: deterministicUuid(NAMESPACE, `exam-scope:${id}:1`), orderNo: 1, type: "JUZ", juzFrom: Math.min(...numbers), juzTo: Math.max(...numbers), customText: null });
      } else {
        scopes.push({ id: deterministicUuid(NAMESPACE, `exam-scope:${id}:1`), orderNo: 1, type: "CUSTOM", juzFrom: null, juzTo: null, customText: cleanText(row.parts_key) || "نطاق اختبار قديم غير قابل للتحويل الآلي" });
      }
    } else {
      scopes.push({ id: deterministicUuid(NAMESPACE, `exam-scope:${id}:1`), orderNo: 1, type: "CUSTOM", juzFrom: null, juzTo: null, customText: cleanText(row.range_text) || "اختبار قديم" });
    }

    const exam: PlannedExam = {
      id,
      studentId: student.id,
      enrollmentId: enrollment?.id ?? null,
      examinerPlannedUserId: examiner.id,
      examDate,
      examType,
      score: parseNumber(row.grade ?? row.score),
      resultLabel: cleanText(row.result || row.grade) || null,
      notes: cleanText(row.notes || row.note) || null,
      legacyEntityType: entityType,
      legacyId,
      scopes,
    };
    exams.push(exam);
    legacyMaps.push({ entityType, legacyId, plannedNewId: id, canonicalKey: `${student.id}|${examDate}|${examType}` });
  };
  simpleExamRows.forEach((row) => buildExam(row, "exam"));
  officialExamRows.forEach((row) => buildExam(row, "official_exam"));

  const users = Array.from(usersByName.values()).sort((left, right) => left.displayName.localeCompare(right.displayName, "ar"));
  const statistics: Record<string, number> = {
    sourceTeachers: teachers.length,
    sourceCampTeachers: campTeachers.length,
    sourceStudents: studentRows.length,
    sourceSessionRecords: primarySessionRows.length,
    sourceFallbackSessions: sessionsFallback.length,
    sourceSimpleExams: simpleExamRows.length,
    sourceOfficialExams: officialExamRows.length,
    plannedUsers: users.length,
    plannedHalaqat: halaqat.length,
    plannedStudents: plannedStudents.length,
    plannedEnrollments: enrollments.length,
    plannedSessions: sessions.length,
    plannedSessionItems: sessions.reduce((total, session) => total + session.items.length, 0),
    plannedActivities: sessions.reduce((total, session) => total + session.items.reduce((itemTotal, item) => itemTotal + item.activities.length, 0), 0),
    plannedExams: exams.length,
    warningCount: warnings.filter((warning) => warning.severity === "WARNING").length,
    errorCount: warnings.filter((warning) => warning.severity === "ERROR").length,
  };

  return {
    version: 1,
    sourceSystem,
    sourceFingerprint: sources.fingerprint,
    generatedAt: new Date().toISOString(),
    inputManifest: Object.entries(sources.hashes).map(([file, hash]) => ({ file, rowCount: sources.files[file as keyof typeof sources.files]?.length ?? 0, sha256: hash ?? "" })).sort((left, right) => left.file.localeCompare(right.file)),
    dateRange: { from: fromDate, to: toDate },
    statistics,
    users,
    programs,
    halaqat: halaqat.sort((left, right) => left.nameAr.localeCompare(right.nameAr, "ar")),
    staffAssignments,
    students: plannedStudents.sort((left, right) => left.fullName.localeCompare(right.fullName, "ar")),
    enrollments,
    sessions: sessions.sort((left, right) => left.sessionDate.localeCompare(right.sessionDate)),
    exams: exams.sort((left, right) => left.examDate.localeCompare(right.examDate)),
    legacyMaps,
    warnings,
  };
}
