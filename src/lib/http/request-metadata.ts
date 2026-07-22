export function getRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim().slice(0, 64) || null;

  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || null;
}

export function getRequestUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 1000) || null;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
