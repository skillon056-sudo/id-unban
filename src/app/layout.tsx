import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteProvider } from "@/lib/site-context";
import { getSettings } from "@/lib/settings";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const branding = {
    logo: s.site_logo || "",
    siteName: s.site_name || siteName,
  };

  return (
    <html lang="en">
      <head>
        {/* Gateway checkout lives on another host — warm DNS+TLS now so the
            post-click redirect isn't paying for a cold handshake. */}
        <link rel="preconnect" href="https://cashier.sunpaytm.quest" />
        <link rel="dns-prefetch" href="https://cashier.sunpaytm.quest" />
      </head>
      <body>
        <MetaPixel />
        <SiteProvider value={branding}>{children}</SiteProvider>
      </body>
    </html>
  );
}
