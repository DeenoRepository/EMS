import { redirect } from "next/navigation";

export default function WmsAdminRedirectPage() {
  redirect("/wms/settings");
}
