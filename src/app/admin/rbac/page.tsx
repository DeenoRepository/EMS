import { redirect } from "next/navigation";

export default function RbacRedirectPage() {
  redirect("/admin/settings?tab=rbac");
}
