import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProductShell } from "@/components/product-shell";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "TraceForge — Incident Command Lab", template: "%s · TraceForge" },
  description: "A deterministic, simulated incident investigation and controlled recovery workbench.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1020" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body><ProductShell>{children}</ProductShell></body>
    </html>
  );
}
