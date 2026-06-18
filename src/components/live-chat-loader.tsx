'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Script from 'next/script';

const DEFAULT_SCRIPT = `var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/69a30f709d76e61c38796886/1jiif8kn3';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();`;

export default function LiveChatLoader({ nonce = '' }: { nonce?: string }) {
  const [scriptContent, setScriptContent] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'siteSettings', 'liveChat'), (snap) => {
      if (snap.exists() && snap.data().script) {
        setScriptContent(snap.data().script);
      } else {
        setScriptContent(DEFAULT_SCRIPT);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!scriptContent) return null;

  return (
    <Script id="dynamic-live-chat" nonce={nonce} strategy="afterInteractive">
      {scriptContent}
    </Script>
  );
}
