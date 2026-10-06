import { NextResponse, type NextRequest } from "next/server";
import { AppPaths } from "@/lib/paths";

const CLIENT_IP_HEADER = "x-client-ip";
const PROXY_SECRET_HEADER = "x-proxy-secret";

// The backend only sees Vercel's address. Hand it the visitor's IP together with the shared secret,
// always discarding whatever the browser sent under these names.
function apiRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);

  const secret = process.env.CLIENT_IP_PROXY_SECRET;
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const clientIp = forwardedIp?.length ? forwardedIp : request.headers.get("x-real-ip");
  if (secret && clientIp) {
    headers.set(CLIENT_IP_HEADER, clientIp);
    headers.set(PROXY_SECRET_HEADER, secret);
  }
  return headers;
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get("tv_access")?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers: apiRequestHeaders(request) } });
  }

  const isProtectedPath = AppPaths.protected.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPath && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/meu-perfil/:path*",
    "/recrutador/:path*",
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
