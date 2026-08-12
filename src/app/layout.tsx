import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EMS — Корпоративная Модульная Платформа",
    template: "%s | EMS",
  },
  description: "Единая система управления предприятием: EPS, MRO, SRM, WMS",
  applicationName: "EMS Platform",
  authors: [{ name: "EMS Team" }],
  keywords: ["EMS", "EPS", "WMS", "MRO", "SRM", "Enterprise", "Management"],
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

// Inline script to prevent theme flash
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('ems_theme');
      if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
