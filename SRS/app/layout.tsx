import type { Metadata } from "next";
import "./globals.css";
import { AppToaster } from "@/components/ui/app-toaster";

export const metadata: Metadata = {
  title: "EFA - Анализ отказов оборудования",
  description: "Анализ отказов оборудования"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
