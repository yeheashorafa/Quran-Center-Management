import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { appConfig } from "@/config/app";
import { RegisterSW } from "@/components/pwa/register-sw";
import { ThemeProvider, themeInitScript } from "@/lib/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.centerName}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07583a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>
          <RegisterSW />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
