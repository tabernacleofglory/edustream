import type { Metadata } from "next";
import { Inter, Space_Grotesk, Dancing_Script, Great_Vibes, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { getSiteSettings } from "@/lib/data";
import { Providers } from "@/components/providers";

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
    keywords: Array.isArray(settings?.seoKeywords) ? settings.seoKeywords.join(', ') : settings?.seoKeywords || "",
    icons: {
      icon: settings?.faviconUrl || '/favicon.ico',
    },
    // Security: Prevent browser translation tools from modifying the DOM, which causes React crashes
    other: {
      google: 'notranslate',
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${spaceGrotesk.variable} ${dancingScript.variable} ${greatVibes.variable} ${sourceSerif.variable}`} 
      suppressHydrationWarning
      translate="no"
    >
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        <Providers>
            {children}
        </Providers>
      </body>
    </html>
  );
}
