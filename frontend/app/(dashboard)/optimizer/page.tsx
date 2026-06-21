import { redirect } from "next/navigation";

// The Reflect page now lives at /reflect (renamed from /optimizer to match the
// "Reflect" branding). Keep this route as a permanent redirect so any existing
// links, bookmarks, or deep links still resolve.
export default function OptimizerRedirectPage() {
  redirect("/reflect");
}
