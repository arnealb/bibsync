import type { Metadata } from "next";
import Link from "next/link";

import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.auth.loginTitle };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;
  const safeRedirect = redirectTo?.startsWith("/app") ? redirectTo : "/app";

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{copy.auth.loginTitle}</CardTitle>
        <CardDescription>{copy.auth.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error === "confirm" && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {copy.auth.confirmFailed}
          </p>
        )}
        <Tabs defaultValue="password">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">{copy.auth.tabPassword}</TabsTrigger>
            <TabsTrigger value="magic">{copy.auth.tabMagicLink}</TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="pt-4">
            <PasswordLoginForm redirectTo={safeRedirect} />
          </TabsContent>
          <TabsContent value="magic" className="pt-4">
            <MagicLinkForm />
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-muted-foreground">
          {copy.auth.noAccount}{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {copy.auth.registerLink}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
