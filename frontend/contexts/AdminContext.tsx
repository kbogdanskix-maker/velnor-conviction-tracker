"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AdminState {
  adminMode: boolean;
  toggleAdmin: () => void;
}

const AdminContext = createContext<AdminState>({ adminMode: false, toggleAdmin: () => {} });

export function AdminProvider({ children }: { children: ReactNode }) {
  // Default to false — real users see only what their tier unlocks.
  // Admin mode (unlock-all) is opt-in via Settings and persisted in storage.
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("vela_admin_mode");
    // Only enable if explicitly turned on previously.
    if (stored === "true") setAdminMode(true);
  }, []);

  function toggleAdmin() {
    setAdminMode((prev) => {
      const next = !prev;
      localStorage.setItem("vela_admin_mode", String(next));
      return next;
    });
  }

  return (
    <AdminContext.Provider value={{ adminMode, toggleAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
