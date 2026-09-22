"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { LocaleProvider } from "@/lib/i18n";

export default function AppShell({
  children,
  companyName,
  pendingCount,
}: {
  children: React.ReactNode;
  companyName: string | null;
  pendingCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <LocaleProvider>
      <div className="flex min-h-full">
        {mobileOpen && (
          <button
            aria-label="Fermer le menu"
            className="fixed inset-0 z-30 bg-text/30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-out md:static md:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar companyName={companyName} onNavigate={() => setMobileOpen(false)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar companyName={companyName} pendingCount={pendingCount} onMenuClick={() => setMobileOpen(true)} />
          <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </LocaleProvider>
  );
}
