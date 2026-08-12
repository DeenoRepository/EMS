import { redirect } from "next/navigation";

export default function EpsAttributesRedirect() {
  redirect("/admin/settings/eps");
}
