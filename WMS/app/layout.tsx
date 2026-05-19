import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { AppToaster } from "@/components/ui/app-toaster";

export const metadata: Metadata = {
  title: "WMS - Управление складом",
  description: "Корпоративный модуль WMS для учета остатков, движений и резервов под заявки MMS",
  icons: {
    icon: "/eps-logo-v2.png",
    shortcut: "/eps-logo-v2.png",
    apple: "/eps-logo-v2.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
