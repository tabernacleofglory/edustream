
'use server';

/**
 * Resolves a generic YouTube "live" URL (like a channel live link) to a specific video URL.
 * This helps bypass issues where players get stuck on redirecting URLs.
 */
export async function resolveYoutubeLiveUrl(url: string): Promise<string> {
  // If it's already a direct watch URL, return it immediately
  if (url.includes('watch?v=') || url.includes('youtu.be/')) {
    return url;
  }

  // Only attempt to resolve if it looks like a live/channel link
  if (!url.includes('/live') && !url.includes('/c/') && !url.includes('/channel/') && !url.includes('/@')) {
    return url;
  }

  try {
    // Fetch the page to find the specific video ID
    // We use a specific User-Agent to ensure we get the Desktop version of the page which contains the metadata we need
    const response = await fetch(url, { 
        cache: 'no-store',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
    });
    
    if (!response.ok) return url;
    
    const html = await response.text();
    
    // 1. Target the 'ytInitialPlayerResponse' which contains the exact video ID being played
    // This is the most reliable way to find the actual live video on a redirecting page
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (playerResponseMatch?.[1]) {
        try {
            const json = JSON.parse(playerResponseMatch[1]);
            const videoId = json?.videoDetails?.videoId;
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
        } catch (e) {
            console.error("Failed to parse player response JSON");
        }
    }

    // 2. Look for the canonical URL which usually updates after the redirect
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)">/);
    if (canonicalMatch?.[1]?.includes('watch?v=')) {
      return canonicalMatch[1];
    }
    
    // 3. Look for OG URL metadata
    const ogMatch = html.match(/<meta property="og:url" content="([^"]+)">/);
    if (ogMatch?.[1]?.includes('watch?v=')) {
        return ogMatch[1];
    }

    // 4. Fallback: looking for specific patterns in ytInitialData (Renderer ID)
    const videoRendererMatch = html.match(/"videoRenderer":\s*\{"videoId":"([^"]+)"/);
    if (videoRendererMatch?.[1]) {
        return `https://www.youtube.com/watch?v=${videoRendererMatch[1]}`;
    }

    return url;
  } catch (error) {
    console.error("Error resolving YouTube live URL:", error);
    return url;
  }
}
