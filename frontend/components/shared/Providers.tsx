"use client";

import { AnimationProvider } from "@/contexts/AnimationContext";
import { AIStyleProvider } from "@/contexts/AIStyleContext";
import { AdminProvider } from "@/contexts/AdminContext";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AnimationProvider>
        <AIStyleProvider>{children}</AIStyleProvider>
      </AnimationProvider>
    </AdminProvider>
  );
}
