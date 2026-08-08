import AppSidebar from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ShellProvider, useShell } from "@/components/layout/shell-context";
import { GlobalSearchModal } from "@/components/layout/global-search-modal";

function InnerShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useShell();

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#17243a] dark:bg-slate-950 dark:text-slate-100">
      <AppSidebar />
      <div
        className={`transition-[margin-left] duration-300 ease-in-out ml-0 ${
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[248px]"
        }`}
      >
        <TopBar />
        {children}
      </div>
      <GlobalSearchModal />
    </div>
  );
}

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellProvider>
      <InnerShell>{children}</InnerShell>
    </ShellProvider>
  );
}
