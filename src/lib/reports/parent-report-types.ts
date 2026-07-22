export type ParentReportEvaluation = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "NEEDS_FOLLOW_UP";

export type ParentReportData = {
  centerName: string;
  reportTitle: string;
  generatedAt: string;
  month: string;
  monthLabel: string;
  student: {
    id: string;
    fullName: string;
    displayName: string;
    parentPhone: string | null;
    gradeLevel: string | null;
    memorizationStartedOn: string | null;
  };
  halaqa: {
    id: string;
    nameAr: string;
    stageName: string;
    teacherName: string | null;
  };
  attendance: {
    present: number;
    absent: number;
    excused: number;
    notHeard: number;
    recordedSessions: number;
    attendanceRate: number;
  };
  achievement: {
    memorizationPages: number;
    reviewPages: number;
    recitationPages: number;
    totalPages: number;
    latestAchievementText: string | null;
    latestTeacherNote: string | null;
  };
  latestExam: {
    id: string;
    examDate: string;
    examType: string;
    score: number | null;
    resultLabel: string | null;
    scopeLabel: string;
  } | null;
  evaluation: {
    code: ParentReportEvaluation;
    label: string;
    colorClass: string;
    description: string;
  };
};
