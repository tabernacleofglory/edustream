
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings, Shield, Link as LinkIcon, Award, Sparkles, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const tools = [
  {
    title: "Site Settings",
    description: "Manage your website's core settings, content, and appearance.",
    href: "/admin/developer/site-settings",
    icon: Settings,
    permission: 'developer'
  },
  {
    title: "Permissions",
    description: "Configure user roles and their access levels across the platform.",
    href: "/admin/permissions",
    icon: Shield,
    permission: 'managePermissions'
  },
   {
    title: "Link Management",
    description: "Add, view, and manage main navigation links.",
    href: "/admin/links",
    icon: LinkIcon,
    permission: 'manageLinks'
  },
   {
    title: "Certificate Builder",
    description: "Customize the text and layout of course certificates.",
    href: "/admin/developer/certificate-builder",
    icon: Award,
    permission: 'developer'
  },
   {
    title: "AI Tools",
    description: "Use AI to assist with content creation and management.",
    href: "/admin/developer/ai-tools",
    icon: Sparkles,
    permission: 'developer'
  },
  {
    title: "Localization",
    description: "Manage text translations for different languages.",
    href: "/admin/developer/localization",
    icon: Globe,
    permission: 'manageLocalization'
  },
];

export default function DeveloperLayout({ children }: { children: ReactNode }) {
    const { hasPermission, loading, user } = useAuth();
    const router = useRouter();
    
    // The developer tools section is special and should only ever be seen by developers.
    const isDeveloper = user?.role === 'developer';

    useEffect(() => {
      if (!loading && !isDeveloper) {
          router.push('/admin/analytics');
      }
    }, [loading, isDeveloper, router]);

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!isDeveloper) {
       return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Developer Access Required</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view the developer tools.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
      );
    }

    const availableTools = tools.filter(tool => hasPermission(tool.permission));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Developer Tools
        </h1>
        <p className="text-muted-foreground">
          Access advanced configuration and management tools for the platform.
        </p>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableTools.map((tool) => (
          <Card key={tool.title}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{tool.title}</CardTitle>
                </div>
                <tool.icon className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{tool.description}</p>
              <Button asChild>
                <Link href={tool.href}>
                  Go to {tool.title} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        {children}
      </div>
    </div>
  );
}
