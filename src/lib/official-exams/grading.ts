export function minimumPassingScore(stageCode: string | null | undefined): number {
  return stageCode === "BRAAIM" ? 80 : 85;
}

export function officialExamResultLabel(
  score: number | null,
  stageCode: string | null | undefined,
  isNotPassed?: boolean,
): string {
  if (isNotPassed || score === null) return "غير مجاز";
  if (score >= 95) return "امتياز";
  if (score >= 90) return "ممتاز";
  if (score >= minimumPassingScore(stageCode)) return "جيد جداً";
  return "غير مجاز";
}

