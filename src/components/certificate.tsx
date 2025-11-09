"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SiteSettings } from "@/lib/data";
import Image from "next/image";
import DynamicIcon from "./dynamic-icon";

interface CertificateProps {
  userName: string;
  courseName?: string;
  completionDate?: string | Date;
  templateUrl?: string;
  logoUrl?: string;
  settings?: Partial<SiteSettings> | null;
}

export default function Certificate({
  userName,
  courseName,
  completionDate,
  templateUrl,
  logoUrl,
  settings,
}: CertificateProps) {
  const finalTemplateUrl =
    templateUrl ||
    settings?.cert_defaultBackgroundUrl ||
    "https://placehold.co/2000x1545.png?text=Background";

  const finalLogoUrl = logoUrl || settings?.cert_defaultLogoUrl;

  const rawDate = completionDate ? new Date(completionDate) : new Date();
  const validDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
  const formattedDate = format(validDate, "MMMM d, yyyy");

  const getValue = (key: keyof SiteSettings, defaultValue: any) => {
    return settings?.[key] ?? defaultValue;
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-white bg-cover bg-center text-center",
        "shadow-sm font-serif"
      )}
      style={{
        aspectRatio: "2000 / 1545",
        containerType: "inline-size",
        backgroundImage: `url(${finalTemplateUrl})`,
        color: "black",
      }}
    >
      <div
        className="absolute w-full"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {getValue("cert_show_title", true) && (
          <h1
            className="font-extrabold"
            style={{
              fontSize: `${getValue("cert_title_size", 4)}cqi`,
              lineHeight: 1.1,
            }}
          >
            {getValue("cert_title", "Certificate")}
          </h1>
        )}
        {getValue("cert_show_subtitle", true) && (
          <h2
            className="font-medium"
            style={{
              fontSize: `${getValue("cert_subtitle_size", 1.5)}cqi`,
              marginTop: `${getValue("cert_spacing_title_subtitle", 0.5)}cqi`,
              lineHeight: 1.2,
            }}
          >
            {getValue("cert_subtitle", "of Completion")}
          </h2>
        )}
        {getValue("cert_show_decoration", true) && (
          <div
            style={{
              marginTop: `${getValue("cert_spacing_subtitle_decoration", 2)}cqi`,
            }}
          >
            <DynamicIcon
              name={getValue("cert_decoration_icon", "Award")}
              style={{
                fontSize: `${getValue("cert_decoration_icon_size", 2.5)}cqi`,
              }}
              className="mx-auto"
            />
          </div>
        )}
        {getValue("cert_show_presentedToText", true) && (
          <p
            className="mt-8"
            style={{
              fontSize: `${getValue("cert_presentedToText_size", 1)}cqi`,
              marginTop: `${getValue(
                "cert_spacing_decoration_presentedTo",
                2
              )}cqi`,
            }}
          >
            {getValue(
              "cert_presentedToText",
              "This certificate is proudly presented to"
            )}
          </p>
        )}
      </div>

      {/* Username */}
      <div className="absolute bottom-[41%] w-full">
        <p
          className="font-dancing-script"
          style={{
            fontSize: `${getValue("cert_userName_size", 4.5)}cqi`,
            transform: "translateX(5%)", // Move username slightly to the right
          }}
        >
          {userName}
        </p>
      </div>

      {/* Completion date (standalone line) */}
      {getValue("cert_show_completionDate", true) && (
        <div className="absolute w-full bottom-[19.5%]">
          <p
            style={{
              fontSize: `${getValue("cert_completionDate_size", 1.6)}cqi`,
              marginTop: `${getValue("cert_spacing_userName_completionDate", 0.8)}cqi`,
              transform: "translateX(20.8%)", // Move date slightly to the right
            }}
          >
            {getValue("cert_completionDate_prefix", "")} {formattedDate}
          </p>
        </div>
      )}

      {/* Signatures & date */}
      {getValue("cert_show_signatures", true) && (
        <div
          className="absolute bottom-[20%] w-full"
          style={{
            marginTop: `${getValue(
              "cert_spacing_courseName_signatures",
              2
            )}cqi`,
          }}
        >
          <div className="grid grid-cols-2 gap-4 items-end text-center mx-auto max-w-sm">
            <div className="border-b border-black/80 pb-1">
              {getValue("cert_show_date", true) && (
                <p style={{ fontSize: `${getValue("cert_date_size", 0.9)}cqi` }}>
                  {formattedDate}
                </p>
              )}
              <p className="text-xs">Date</p>
            </div>
            <div className="border-b border-black/80 pb-1">
              <p
                className="font-dancing-script"
                style={{
                  fontSize: `${getValue("cert_signatureName_size", 1.8)}cqi`,
                }}
              >
                {getValue("cert_signatureName", "Gregory Toussaint")}
              </p>
              <p
                className="text-xs"
                style={{
                  fontSize: `${getValue("cert_signatureTitle_size", 0.9)}cqi`,
                }}
              >
                {getValue("cert_signatureTitle", "Senior Pastor")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
