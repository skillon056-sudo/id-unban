"use client";

import { createContext, useContext } from "react";

// Branding read once in the root layout (server) and shared with client
// components like the navbar, which render on both server and client pages.
export interface SiteBranding {
  logo: string; // "" = fall back to the built-in badge
  siteName: string;
}

const SiteContext = createContext<SiteBranding>({ logo: "", siteName: "" });

export function SiteProvider({
  value,
  children,
}: {
  value: SiteBranding;
  children: React.ReactNode;
}) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
