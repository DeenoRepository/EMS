import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionCookieName, parseSessionToken } from "@/lib/server/auth";

export default function Home() {
  const token = cookies().get(getSessionCookieName())?.value;
  const session = parseSessionToken(token);
  redirect(session ? "/dashboard" : "/login");
}
