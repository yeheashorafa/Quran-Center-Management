export function minimumPassingScore(stageCode: string | null | undefined): number {
  return stageCode === "BRAAIM" ? 80 : 85;
}

export function officialExamResultLabel(
  score: number,
  stageCode: string | null | undefined,
): string {
  if (score >= 95) return "امتياز";
  if (score >= 90) return "ممتاز";
  if (score >= minimumPassingScore(stageCode)) return "جيد جداً";
  return "غير مجتاز";
}
