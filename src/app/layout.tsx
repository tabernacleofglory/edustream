import type { Metadata } from "next";
import { Inter, Space_Grotesk, Dancing_Script, Great_Vibes, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getSiteSettings } from "@/lib/data";

// This tells Next.js to always re-evaluate this page and not cache it.
export const revalidate = 0;
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dancing-script",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-great-vibes",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: settings?.websiteName || "Glory Training Hub",
    description: settings?.metaDescription || "Transforming lives through Christ-centered learning.",
    keywords: settings?.seoKeywords || "",
    icons: {
      icon: settings?.faviconUrl || '/favicon.ico',
    },
  };
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${dancingScript.variable} ${greatVibes.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
