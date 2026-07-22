export const SESSION_COOKIE_NAME = "qcm_session";

export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
export const REMEMBERED_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export const DASHBOARD_PATHS = {
  TEACHER: "/teacher",
  CENTER_MANAGER: "/manager",
  EXAMINER: "/examiner",
} as const;

export type AppRoleCode = keyof typeof DASHBOARD_PATHS;

export function isAppRoleCode(value: string): value is AppRoleCode {
  return value in DASHBOARD_PATHS;
}

export function getDashboardPath(roleCode: string): string {
  return isAppRoleCode(roleCode) ? DASHBOARD_PATHS[roleCode] : "/unauthorized";
}
