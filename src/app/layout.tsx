import type { Metadata } from "next";
import { Inter, Space_Grotesk, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { getSiteSettings } from "@/lib/data";
import { Providers } from "@/components/providers";
import LiveChatLoader from "@/components/live-chat-loader";
import AiChatWidget from "@/components/ai-chat-widget";
import { headers } from "next/headers";

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
    other: {
      google: 'notranslate',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') || '';

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
      translate="no"
    >
      <head>
        <meta name="google" content="notranslate" />
        {nonce && <meta name="csp-nonce" content={nonce} />}
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        <LiveChatLoader nonce={nonce} />
        <AiChatWidget />
      </body>
    </html>
  );
}
