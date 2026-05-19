import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { AuthShell } from "@/components/layout/auth-shell";
import { AppHotkeys } from "@/components/layout/app-hotkeys";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <div className="flex h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only z-[200] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Перейти к основному содержимому
        </a>
        <AppSidebar />
        <div className="ml-72 flex flex-1 flex-col">
          <AppHotkeys />
          <TopBar />
          <main id="main-content" className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </AuthShell>
  );
}
