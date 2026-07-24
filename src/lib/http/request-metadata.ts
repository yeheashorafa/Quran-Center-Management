function parseOrigin(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function getRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim().slice(0, 64) || null;

  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || null;
}

export function getRequestUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 1000) || null;
}

export function isSameOriginRequest(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  let requestOrigin: string | null = null;
  if (originHeader) {
    requestOrigin = parseOrigin(originHeader);
  } else if (refererHeader) {
    requestOrigin = parseOrigin(refererHeader);
  }

  const allowedOrigins = new Set<string>();

  // 1. Environment variables (APP_URL and NEXT_PUBLIC_APP_URL)
  const envAppUrl = parseOrigin(process.env.APP_URL);
  if (envAppUrl) allowedOrigins.add(envAppUrl);

  const envPublicAppUrl = parseOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (envPublicAppUrl) allowedOrigins.add(envPublicAppUrl);

  // 2. NextUrl / Request URL
  const nextUrlOrigin = (request as unknown as { nextUrl?: { origin?: string } }).nextUrl?.origin;
  if (nextUrlOrigin) {
    const parsed = parseOrigin(nextUrlOrigin);
    if (parsed) allowedOrigins.add(parsed);
  }

  const requestUrlOrigin = parseOrigin(request.url);
  if (requestUrlOrigin) allowedOrigins.add(requestUrlOrigin);

  // 3. Host & Forwarded headers
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) {
    const constructed = parseOrigin(`${proto}://${host}`);
    if (constructed) allowedOrigins.add(constructed);

    // Support both http and https matching for proxy host headers
    const constructedHttp = parseOrigin(`http://${host}`);
    if (constructedHttp) allowedOrigins.add(constructedHttp);
    const constructedHttps = parseOrigin(`https://${host}`);
    if (constructedHttps) allowedOrigins.add(constructedHttps);
  }

  if (!requestOrigin) {
    console.warn("Blocked auth request", {
      origin: originHeader,
      referer: refererHeader,
      expectedOrigins: Array.from(allowedOrigins),
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    });
    return false;
  }

  const isAllowed = allowedOrigins.has(requestOrigin);

  if (!isAllowed) {
    console.warn("Blocked auth request", {
      origin: originHeader,
      referer: refererHeader,
      expectedOrigins: Array.from(allowedOrigins),
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    });
  }

  return isAllowed;
}
