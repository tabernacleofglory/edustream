
import { ReactNode } from "react";

export default function FullscreenLayout({ children }: { children: ReactNode }) {
  return <div className="h-screen w-screen">{children}</div>;
}
