import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { hasRole, hasModuleAccess } from "@/lib/auth/rbac";
import { MODULES_CONFIG } from "@/lib/config/modules";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ems_session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Сессия недействительна или истекла" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // RBAC protection for admin routes
  if (pathname.startsWith("/admin") && !hasRole(session, ["ADMIN"])) {
    const modulesUrl = new URL("/modules", request.url);
    return NextResponse.redirect(modulesUrl);
  }

  // RBAC protection for API admin routes
  if (pathname.startsWith("/api/admin") && !hasRole(session, ["ADMIN"])) {
    return NextResponse.json({ error: "Доступ запрещен: требуется роль Администратора" }, { status: 403 });
  }

  // Dynamic RBAC Protection for Business Modules (/modules/[moduleId])
  const moduleMatch = pathname.match(/^\/modules\/([^/]+)/);
  if (moduleMatch) {
    const moduleId = moduleMatch[1];
    if (MODULES_CONFIG[moduleId]) {
      if (!hasModuleAccess(session, moduleId)) {
        const rootUrl = new URL("/", request.url);
        return NextResponse.redirect(rootUrl);
      }
    }
  }

  // Specific route protection rules
  if (pathname.startsWith("/modules/eps/approval-queue") && !hasRole(session, ["APPROVER", "ADMIN"])) {
    const epsUrl = new URL("/modules/eps", request.url);
    return NextResponse.redirect(epsUrl);
  }

  if (pathname.startsWith("/modules/eps/new") && !hasRole(session, ["EDITOR", "APPROVER", "ADMIN"])) {
    const epsUrl = new URL("/modules/eps", request.url);
    return NextResponse.redirect(epsUrl);
  }

  if (pathname.startsWith("/modules/eps/reports") && !hasRole(session, ["APPROVER", "ADMIN"])) {
    const epsUrl = new URL("/modules/eps", request.url);
    return NextResponse.redirect(epsUrl);
  }

  if (pathname.startsWith("/modules/eps/change-history") && !hasRole(session, ["EDITOR", "APPROVER", "ADMIN"])) {
    const epsUrl = new URL("/modules/eps", request.url);
    return NextResponse.redirect(epsUrl);
  }

  if (pathname.startsWith("/modules/wms/movements") && !hasRole(session, ["STOREKEEPER", "ADMIN"])) {
    const wmsUrl = new URL("/modules/wms", request.url);
    return NextResponse.redirect(wmsUrl);
  }

  if (pathname.startsWith("/modules/wms/personal-cards") && !hasRole(session, ["STOREKEEPER", "ADMIN"])) {
    const wmsUrl = new URL("/modules/wms", request.url);
    return NextResponse.redirect(wmsUrl);
  }

  if (pathname.startsWith("/modules/wms/topology") && !hasRole(session, ["STOREKEEPER", "ADMIN"])) {
    const wmsUrl = new URL("/modules/wms", request.url);
    return NextResponse.redirect(wmsUrl);
  }

  if (pathname.startsWith("/modules/wms/requisitions") && !hasRole(session, ["STOREKEEPER", "ADMIN"])) {
    const wmsUrl = new URL("/modules/wms", request.url);
    return NextResponse.redirect(wmsUrl);
  }

  if (pathname.startsWith("/modules/wms/toir-eps") && !hasRole(session, ["STOREKEEPER", "ADMIN"])) {
    const wmsUrl = new URL("/modules/wms", request.url);
    return NextResponse.redirect(wmsUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
