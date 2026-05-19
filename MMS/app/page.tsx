import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, DEMO_COOKIE } from "@/lib/auth/session";

export default async function Home() {
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(AUTH_COOKIE)?.value || cookieStore.get(DEMO_COOKIE)?.value);
  redirect(hasSession ? "/dashboard" : "/login");
}
