import type { NextRequest } from "next/server";

export function getRequestIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return "unknown";
}

export function getRequestUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}