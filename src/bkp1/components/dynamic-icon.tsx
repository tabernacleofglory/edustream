
"use client";

import { icons, LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

const DynamicIcon = ({ name, ...props }: DynamicIconProps) => {
  const LucideIcon = icons[name as keyof typeof icons];

  if (!LucideIcon) {
    // You can return a default icon or null
    return null;
  }

  return <LucideIcon {...props} />;
};

export default DynamicIcon;
