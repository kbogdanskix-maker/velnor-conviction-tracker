import { redirect } from "next/navigation";

// /alerts consolidated into /smart-alerts — keep this route as a permanent redirect
// so any existing links or bookmarks still resolve.
export default function AlertsPage() {
  redirect("/smart-alerts");
}
