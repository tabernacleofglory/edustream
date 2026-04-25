
import type { EmailLayoutSettings } from './types';

export function wrapInEmailLayout(content: string, settings: EmailLayoutSettings, buttonText?: string, buttonUrl?: string) {
    const headerTitle = settings.headerTitle || "Glory Training Hub";
    const headerSlogan = settings.headerSlogan || "Forming Solid disciples for Christ";
    const headerLogo = settings.headerLogoUrl || "https://firebasestorage.googleapis.com/v0/b/edustream-5t6z4.appspot.com/o/site%2Flogo.png?alt=media";
    const bgStart = settings.headerGradientStart || "#004d40";
    const bgEnd = settings.headerGradientEnd || "#00897b";
    const bodyBg = settings.bodyBgColor || "#f4f4f4";
    const cardBg = settings.cardBgColor || "#ffffff";
    const btnColor = settings.buttonColor || "#00897b";
    const btnTextColor = settings.buttonTextColor || "#ffffff";
    const footer = settings.footerText || "© 2024 Tabernacle of Glory. All rights reserved.";
    const preHeader = settings.preHeaderText || "";
    
    // Default to provided arguments, then to settings, then to fallback
    const btnText = buttonText || settings.buttonText || "Continue Courses";
    const btnUrl = buttonUrl || settings.buttonUrl || "https://gloryhub.net/dashboard";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${bodyBg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="padding: 40px 20px;">
        ${preHeader ? `<div style="text-align: center; margin-bottom: 20px; font-weight: bold; color: ${bgStart}; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">${preHeader}</div>` : ''}
        <div style="max-width: 600px; margin: 0 auto; background-color: ${cardBg}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(to right, ${bgStart}, ${bgEnd}); padding: 40px 20px; text-align: center; color: #ffffff;">
                <img src="${headerLogo}" alt="Logo" style="height: 60px; margin-bottom: 20px; display: inline-block;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">${headerTitle}</h1>
                <p style="margin: 10px 0 0; font-style: italic; font-size: 14px; opacity: 0.9;">${headerSlogan}</p>
            </div>
            <div style="padding: 40px; line-height: 1.6; color: #333333; font-size: 16px;">
                ${content}
                <div style="text-align: center; margin-top: 40px;">
                    <a href="${btnUrl}" style="background-color: ${btnColor}; color: ${btnTextColor}; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">${btnText}</a>
                </div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 30px; color: #888888; font-size: 12px; max-width: 600px; margin-left: auto; margin-right: auto;">
            ${footer}
        </div>
    </div>
</body>
</html>
    `.trim();
}
