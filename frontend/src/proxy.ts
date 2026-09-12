import { NextResponse, type NextRequest } from "next/server";
import { AppPaths } from "@/lib/paths";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("tv_access")?.value;
  const { pathname } = request.nextUrl;

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
