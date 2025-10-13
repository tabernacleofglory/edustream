
"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

// Sidebar context
const SidebarContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  open: true,
  setOpen: () => {},
});

export const SidebarProvider = ({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = React.useState(true);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = React.useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

// Sidebar component
export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar();
  return (
    <aside
      ref={ref}
      className={cn(
        "flex flex-col gap-2 border-r bg-background transition-all duration-300 ease-in-out z-50",
        "md:flex", // Always flex on medium and up
        open ? "w-64 md:w-64" : "w-0 md:w-14", // Control width based on open state
        open ? "translate-x-0" : "-translate-x-full", // Slide in/out on mobile
        "md:translate-x-0", // Always visible on desktop
        "fixed md:relative inset-y-0 left-0",
        className
      )}
      {...props}
    />
  );
});
Sidebar.displayName = "Sidebar";

// Sidebar header
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("sticky top-0 p-2", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

// Sidebar content
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-x-hidden overflow-y-auto", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

// Sidebar footer
export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-2", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

// Sidebar trigger
export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSidebar();
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      onClick={() => setOpen(!open)}
      className={cn("transition-transform", open && "rotate-180", className)}
      {...props}
    >
      <ChevronRight />
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

// Sidebar menu
export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-2 p-2", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

// Sidebar menu item
export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => {
  return <li ref={ref} className={cn("", className)} {...props} />;
});
SidebarMenuItem.displayName = "SidebarMenuItem";

// Sidebar menu button
const sidebarMenuButtonVariants = cva(
  "flex items-center gap-2 rounded-md p-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      isActive: {
        true: "bg-primary text-primary-foreground",
        false: "hover:bg-accent",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);
export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  tooltip?: React.ComponentPropsWithoutRef<typeof TooltipContent>;
}
export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, isActive, asChild = false, tooltip, ...props }, ref) => {
  const { open } = useSidebar();
  const ButtonComponent = (
    <button
      ref={ref}
      className={cn(sidebarMenuButtonVariants({ isActive }), !open && "justify-center", className)}
      {...props}
    />
  );

  if (!open && tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{ButtonComponent}</TooltipTrigger>
          <TooltipContent {...tooltip} />
        </Tooltip>
      </TooltipProvider>
    );
  }

  return ButtonComponent;
});
SidebarMenuButton.displayName = "SidebarMenuButton";

// Sidebar menu sub
export const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      className={cn("flex flex-col gap-2 py-2 pl-4", className)}
      {...props}
    />
  );
});
SidebarMenuSub.displayName = "SidebarMenuSub";

// Sidebar menu sub item
export const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => {
  return <li ref={ref} className={cn("", className)} {...props} />;
});
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

// Sidebar menu sub button
const sidebarMenuSubButtonVariants = cva(
  "flex items-center gap-2 rounded-md p-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      isActive: {
        true: "bg-secondary text-secondary-foreground",
        false: "hover:bg-muted",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);
export interface SidebarMenuSubButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuSubButtonVariants> {
  asChild?: boolean;
}
export const SidebarMenuSubButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuSubButtonProps
>(({ className, isActive, asChild = false, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(sidebarMenuSubButtonVariants({ isActive }), className)}
      {...props}
    />
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
