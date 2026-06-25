import { redirect } from "next/navigation";

export default function NWHistoryRedirect() {
  redirect("/net-worth?tab=history");
}
