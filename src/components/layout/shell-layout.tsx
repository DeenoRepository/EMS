import AppSidebar from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ShellProvider, useShell } from "@/components/layout/shell-context";
import { GlobalSearchModal } from "@/components/layout/global-search-modal";
import { ToastProvider } from "@/components/ui/toast";

function InnerShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useShell();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>
      <AppSidebar />
      <div
        className={`transition-[margin-left] duration-300 ease-out ml-0 ${sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[248px]"
          }`}
      >
        <TopBar />
        <main id="main-content" className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
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
    <ToastProvider>
      <ShellProvider>
        <InnerShell>{children}</InnerShell>
      </ShellProvider>
    </ToastProvider>
  );
}
