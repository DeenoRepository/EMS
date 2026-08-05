import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMS — Корпоративная Модульная Платформа",
  description: "Единая система управления предприятием: EPS, MRO, SRM, WMS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
