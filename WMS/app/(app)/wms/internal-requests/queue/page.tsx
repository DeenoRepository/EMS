import { redirect } from "next/navigation";

export default function QueueRedirectPage() {
  redirect("/wms/internal-requests");
}
