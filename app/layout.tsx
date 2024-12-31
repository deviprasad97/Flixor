import type { Metadata } from "next";
import "./globals.css";
import { Appbar } from "@/components/appbar";
import { ReactNode, Suspense } from "react";
import Providers from "@/components/providers";
import { Quicksand } from "next/font/google";
import "@/app/slider.scss";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const quicksand = Quicksand({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flixor",
  description: "Alternative plex ui",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/plexicon.png" />
      </head>
      <body className={`${quicksand.className} antialiased bg-background`}>
        <Suspense>
          <Providers>
            <Appbar />
            {children}
          </Providers>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      </body>
    </html>
  );
}
