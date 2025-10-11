
"use client";

import { format } from "date-fns";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SiteSettings, getSiteSettings } from "@/lib/data";
import { useEffect, useState, useRef } from "react";
import { Skeleton } from "./ui/skeleton";
import DynamicIcon from "./dynamic-icon";

interface CertificateProps {
  userName: string;
  courseName: string;
  completionDate?: string;
  templateUrl?: string;
  logoUrl?: string;
  settingsOverride?: Partial<SiteSettings>; // For live preview in builder
}

const DecorativeBorder = () => (
    <div className="absolute inset-0 w-full h-full p-[2cqw]">
        <div className="w-full h-full border-[0.2cqw] border-[#C0C0C0]" />
    </div>
);

export default function Certificate({ userName, courseName, completionDate, templateUrl, logoUrl, settingsOverride }: CertificateProps) {
  const [settings, setSettings] = useState<Partial<SiteSettings> | null>(settingsOverride || null);
  const [loading, setLoading] = useState(!settingsOverride);
  const [aspectRatio, setAspectRatio] = useState('11 / 8.5'); // Default aspect ratio
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (settingsOverride) {
      setSettings(settingsOverride);
      setLoading(false);
    } else {
        const fetchSettings = async () => {
        setLoading(true);
        const siteSettings = await getSiteSettings();
        setSettings(siteSettings);
        setLoading(false);
        };
        fetchSettings();
    }
  }, [settingsOverride]);

  const finalTemplateUrl = templateUrl || settings?.cert_defaultBackgroundUrl || "https://placehold.co/1100x850.png?text=Background";
  
  useEffect(() => {
    if (finalTemplateUrl && finalTemplateUrl !== 'none') {
        const img = document.createElement('img');
        img.src = finalTemplateUrl;
        img.onload = () => {
            setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        };
    } else {
        setAspectRatio('11 / 8.5');
    }
  }, [finalTemplateUrl]);
  
  // The completionDate prop is the dynamic date passed in. If it's not available (e.g., in a preview), it defaults to today.
  const dateToFormat = completionDate ? new Date(completionDate) : new Date();
  const isValidDate = !isNaN(dateToFormat.getTime());
  const formattedCompletionDate = isValidDate 
    ? format(dateToFormat, "MMMM d, yyyy")
    : format(new Date(), "MMMM d, yyyy");

  
  const presentedToText = settings?.cert_presentedToText || "This certificate is proudly presented to";
  const completionText = settings?.cert_completionText || "for successfully completing the course of";
  const signatureName = settings?.cert_signatureName || "Gregory Toussaint";
  const signatureTitle = settings?.cert_signatureTitle || "Senior Pastor";
  
  const finalLogoUrl = logoUrl || settings?.cert_defaultLogoUrl;

  const hasBackground = finalTemplateUrl && finalTemplateUrl !== 'none';
  
  const getFontSize = (size?: number) => {
    if (!size) return {};
    return { fontSize: `clamp(0.5rem, ${size}cqi, ${size}rem)` };
  };

  const getIconSize = (size?: number) => {
    if (!size) return {};
    return { width: `clamp(1rem, ${size}cqi, ${size}rem)`, height: `clamp(1rem, ${size}cqi, ${size}rem)` };
  }

  const getMarginBottom = (size?: number) => {
    if (size === undefined) return {};
    return { marginBottom: `${size}cqw` };
  };


  if (loading) {
    return <Skeleton className="w-full aspect-[11/8.5]" />;
  }

  return (
    <div 
        ref={containerRef}
        className={cn(
            "relative w-full bg-white bg-cover bg-center overflow-hidden",
        )}
        style={{ 
            aspectRatio: aspectRatio,
            containerType: 'inline-size',
            ...(hasBackground ? { 
                backgroundImage: `url(${finalTemplateUrl})`,
            } : {})
        }}
    >
      <DecorativeBorder />
      <div className="relative z-10 flex flex-col items-center justify-between h-full text-center px-[4cqw] py-[2cqw]">
        
        <div className="w-full flex flex-col items-center">
            <p className="font-serif uppercase tracking-widest text-[#3F51B5] font-bold" style={{...getFontSize(settings?.cert_title_size || 3), ...getMarginBottom(settings?.cert_spacing_title_subtitle)}}>{settings?.cert_title || "Certificate"}</p>
            <p className="font-serif uppercase tracking-widest text-gray-500 font-medium" style={{...getFontSize(settings?.cert_subtitle_size || 2), ...getMarginBottom(settings?.cert_spacing_subtitle_decoration)}}>{settings?.cert_subtitle || "of Completion"}</p>
            <div className="w-1/3 my-[1cqw] flex items-center gap-[1cqw]" style={getMarginBottom(settings?.cert_spacing_decoration_presentedTo)}>
              <div className="flex-1 h-px bg-gray-400" />
              <DynamicIcon name={settings?.cert_decoration_icon || "Award"} className="text-gray-500" style={getIconSize(settings?.cert_decoration_icon_size)} />
              <div className="flex-1 h-px bg-gray-400" />
            </div>
        </div>
        
        <div className="w-full flex flex-col items-center">
            <p className="text-gray-500" style={{...getFontSize(settings?.cert_presentedToText_size || 1.125), ...getMarginBottom(settings?.cert_spacing_presentedTo_userName)}}>{presentedToText}</p>
            <div style={getMarginBottom(settings?.cert_spacing_userName_completionText)}>
                <p className="text-gray-800 font-dancing-script leading-tight" style={getFontSize(settings?.cert_userName_size || 5)}>{userName}</p>
                {settings?.cert_showLineUnderUserName && <div className="w-full h-px bg-gray-400 mt-[0.5cqw]" />}
            </div>
            <p className="text-gray-500" style={{...getFontSize(settings?.cert_completionText_size || 1.125), ...getMarginBottom(settings?.cert_spacing_completionText_courseName)}}>{completionText}</p>
            <p className="font-semibold text-gray-700 font-serif" style={{...getFontSize(settings?.cert_courseName_size || 2), ...getMarginBottom(settings?.cert_spacing_courseName_signatures)}}>{courseName}</p>
        </div>

        <div className="w-full flex justify-between items-end gap-2">
            <div className="text-center flex-1 basis-1/3">
                <p className="pb-1 border-b-2 border-gray-400 text-gray-700" style={getFontSize(settings?.cert_date_size || 1)}>{formattedCompletionDate}</p>
                <p className="text-xs text-muted-foreground mt-1" style={getFontSize(settings?.cert_date_size || 1)}>Date</p>
            </div>
            
            <div className="flex-1 basis-1/3">
              {/* Logo was here */}
            </div>

            <div className="text-center flex-1 basis-1/3">
                <p className="pb-1 border-b-2 border-gray-400 font-great-vibes text-gray-700" style={getFontSize(settings?.cert_signatureName_size || 2)}>{signatureName}</p>
                <p className="text-xs text-muted-foreground mt-1" style={getFontSize(settings?.cert_signatureTitle_size || 1)}>{signatureTitle}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
