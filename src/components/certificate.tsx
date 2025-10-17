
"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SiteSettings, getSiteSettings } from "@/lib/data";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui/skeleton";
import Image from "next/image";

// ======= TWEAK THESE 4 PERCENTAGES IF YOU NEED MICRO-ADJUSTMENTS =======
const NAME_TOP = 47;   // % from top where the NAME baseline should sit
const NAME_LEFT = 48;  // % from left (50 = exact center)
const DATE_TOP = 80;   // % from top for the DATE line
const DATE_LEFT = 74;  // % from left for the DATE line (right side area)
// =======================================================================

interface CertificateProps {
  userName: string;
  courseName?: string;       // optional; not shown on this layout
  completionDate?: string | Date;   // ISO string or Date object (fallbacks to today)
  templateUrl?: string;      // background image (2000x1545)
  settingsOverride?: Partial<SiteSettings>;
}

export default function Certificate({
  userName,
  courseName,
  completionDate,
  templateUrl,
  settingsOverride,
}: CertificateProps) {
  const [settings, setSettings] = useState<Partial<SiteSettings> | null>(settingsOverride || null);
  const [loading, setLoading] = useState(!settingsOverride);

  // Use your new artwork by default if not provided
  const finalTemplateUrl =
    templateUrl ||
    settings?.cert_defaultBackgroundUrl ||
    "https://placehold.co/2000x1545.png?text=Background";

  useEffect(() => {
    if (settingsOverride) {
      setSettings(settingsOverride);
      setLoading(false);
      return;
    }
    const run = async () => {
      setLoading(true);
      const siteSettings = await getSiteSettings();
      setSettings(siteSettings);
      setLoading(false);
    };
    run();
  }, [settingsOverride]);

  // Date formatting (fallback to today if missing/invalid)
  const rawDate = completionDate ? new Date(completionDate) : new Date();
  const validDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
  const formattedDate = format(validDate, "MMMM d, yyyy");

  if (loading) {
    return <Skeleton className="w-full aspect-[2000/1545]" />;
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-white bg-cover bg-center",
        "shadow-sm"
      )}
      style={{
        aspectRatio: "2000 / 1545",          // lock to your art board ratio
        containerType: "inline-size",        // enable cqi units for typography
        backgroundImage: `url(${finalTemplateUrl})`,
      }}
    >
      {/* NAME — centered under 'décerné à' */}
      <div
        className="absolute text-center text-gray-800"
        style={{
          top: `${NAME_TOP}%`,
          left: `${NAME_LEFT}%`,
          transform: "translate(-50%, -50%)",
          fontSize: "clamp(1.5rem, 6cqi, 5rem)",
          lineHeight: 1,
          fontFamily: "var(--font-dancing-script, 'Dancing Script', cursive)",
          fontWeight: 600,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          maxWidth: "85%",
        }}
      >
        {userName}
      </div>

      {/* DATE — right side box above the 'Date' label */}
      <div
        className="absolute text-gray-700"
        style={{
          top: `${DATE_TOP}%`,
          left: `${DATE_LEFT}%`,
          transform: "translate(-50%, -50%)",
          fontSize: "clamp(0.55rem, 2.2cqi, 1.15rem)",
          lineHeight: 1.1,
          textAlign: "center",
          minWidth: "14cqi",
        }}
      >
        <div>
          {formattedDate}
        </div>
      </div>
    </div>
  );
}
