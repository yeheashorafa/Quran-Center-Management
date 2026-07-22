import type { AppRoleCode } from "@/lib/auth/constants";

export type LoginStageOption = {
  id: string;
  code: string;
  label: string;
};

export type LoginUserOption = {
  id: string;
  displayName: string;
  roles: AppRoleCode[];
  stageIds: string[];
};

export type LoginOptionsResponse = {
  stages: LoginStageOption[];
  users: LoginUserOption[];
};

export type AuthenticatedSession = {
  sessionId: string;
  expiresAt: Date;
  user: {
    id: string;
    displayName: string;
  };
  role: {
    id: string;
    code: AppRoleCode;
    nameAr: string;
  };
  permissions: string[];
};
