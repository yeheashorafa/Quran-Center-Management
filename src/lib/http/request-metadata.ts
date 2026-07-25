import { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function uniqueOrigins(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function isSameOriginRequest(request: Request | NextRequest): boolean {
  const method = request.method.toUpperCase();

  if (SAFE_METHODS.has(method)) {
    return true;
  }

  const headers = request.headers;

  const origin = normalizeOrigin(headers.get("origin"));
  const refererOrigin = normalizeOrigin(headers.get("referer"));

  let requestOrigin: string | null = null;

  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = null;
  }

  const host = headers.get("host");
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto") || "https";

  const hostOrigin = host ? `${forwardedProto}://${host}` : null;
  const forwardedOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : null;

  const allowedOrigins = uniqueOrigins([
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin,
    hostOrigin,
    forwardedOrigin,
  ]);

  const actualOrigin = origin || refererOrigin;

  const isAllowed = Boolean(
    actualOrigin && allowedOrigins.includes(actualOrigin),
  );

  if (!isAllowed) {
    console.warn("Blocked unsafe request", {
      method,
      origin,
      referer: headers.get("referer"),
      actualOrigin,
      allowedOrigins,
      host,
      forwardedHost,
      forwardedProto,
    });
  }

  return isAllowed;
}