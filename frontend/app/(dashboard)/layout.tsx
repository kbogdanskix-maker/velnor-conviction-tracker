import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import Sidebar from "@/components/shared/Sidebar";
import CommandPalette from "@/components/shared/CommandPalette";
import Starfield from "@/components/celestial/Starfield";
import SplashScreen from "@/components/celestial/SplashScreen";
import Providers from "@/components/shared/Providers";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Providers>
      <SplashScreen>
        <div className="flex min-h-screen bg-vela-bg atmospheric-bg noise-overlay">
          {/* Celestial backdrop: animated teal aurora (.atmospheric-bg) + subtle starfield */}
          <Starfield count={70} />

          <Sidebar />
          <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </div>
          </main>
          <CommandPalette />
        </div>
      </SplashScreen>
    </Providers>
  );
}
