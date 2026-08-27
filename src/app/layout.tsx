import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MetaPixel } from "@/components/MetaPixel";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "FF ID Recovery";
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${siteName} — Free Fire ID Recovery & Unban`,
    template: `%s — ${siteName}`,
  },
  description:
    "Check your Free Fire ID ban status and submit an unban request. Fast, secure account recovery support.",
  applicationName: siteName,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: `${siteName} — Free Fire ID Recovery & Unban`,
    description: "Check your Free Fire ID ban status and submit an unban request.",
    type: "website",
    siteName,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
