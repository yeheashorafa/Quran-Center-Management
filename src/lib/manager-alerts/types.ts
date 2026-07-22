export type ManagerAlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export type ManagerAlertItem = {
  id: string;
  severity: ManagerAlertSeverity;
  category: "SESSION" | "USER" | "HALAQA" | "STUDENT";
  title: string;
  description: string;
  date: string | null;
  href: string | null;
};

export type ManagerAlertsData = {
  date: string;
  lookbackDays: number;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  alerts: ManagerAlertItem[];
};
