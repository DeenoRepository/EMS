import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth/session";

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_COOKIE)?.value;
  redirect(session ? "/dashboard" : "/login");
}
