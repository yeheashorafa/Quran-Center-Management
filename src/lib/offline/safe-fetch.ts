"use client";

export type SafeFetchResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string; isOffline: boolean };

export async function safeApiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<SafeFetchResult<T>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      ok: false,
      status: 0,
      message: "أنت تعمل حالياً بدون إنترنت. هذه العملية تتطلب اتصالات بالشبكة.",
      isOffline: true,
    };
  }

  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        "Accept": "application/json",
        ...(init?.headers || {}),
      },
    });

    let payload: { message?: string } & T;
    try {
      payload = await response.json();
    } catch {
      payload = {} as { message?: string } & T;
    }

    if (!response.ok) {
      let friendlyMessage = payload.message || "تعذر تنفيذ العملية.";

      if (response.status === 401 || response.status === 403) {
        friendlyMessage = "انتهت الجلسة أو يلزم تسجيل الدخول بالإنترنت.";
      } else if (response.status === 404) {
        friendlyMessage = "العنصر المطلوبة غير موجود على السيرفر.";
      } else if (response.status === 409) {
        friendlyMessage = payload.message || "يوجد تعارض في البيانات مع الخادم.";
      } else if (response.status >= 500) {
        friendlyMessage = "حدث خطأ مؤقت في الخادم، الرجاء المحاولة لاحقاً.";
      }

      return {
        ok: false,
        status: response.status,
        message: friendlyMessage,
        isOffline: false,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload as T,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message: "لا يوجد اتصال بالسيرفر حالياً. يرجى التحقق من الشبكة.",
      isOffline: true,
    };
  }
}
