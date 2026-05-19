const isProd = process.env.NODE_ENV === "production";
const insecureCookies = (process.env.AUTH_COOKIE_INSECURE || "false").toLowerCase() === "true";
const secureCookies = isProd && !insecureCookies;
const sameSite = ((process.env.AUTH_COOKIE_SAMESITE || "lax").toLowerCase() === "strict" ? "strict" : "lax") as "lax" | "strict";

export const AUTH_COOKIE = secureCookies ? "__Host-auth_user" : "auth_user";
export const DEMO_COOKIE = secureCookies ? "__Host-demo_user" : "demo_user";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite,
    secure: secureCookies,
    path: "/",
    priority: "high" as const,
    maxAge: 60 * 60 * 8
  };
}

export function demoCookieOptions() {
  return {
    httpOnly: false,
    sameSite,
    secure: secureCookies,
    path: "/",
    priority: "medium" as const,
    maxAge: 60 * 60 * 4
  };
}

export function clearCookieOptions() {
  return {
    path: "/"
  };
}
