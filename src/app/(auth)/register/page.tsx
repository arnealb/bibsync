import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.auth.registerTitle };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{copy.auth.registerTitle}</CardTitle>
        <CardDescription>{copy.auth.registerSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          {copy.auth.haveAccount}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {copy.auth.loginLink}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
