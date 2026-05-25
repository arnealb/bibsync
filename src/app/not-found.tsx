import Link from "next/link";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold tracking-tight text-muted-foreground">
        404
      </p>
      <h1 className="text-xl font-semibold">{copy.notFound.title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {copy.notFound.body}
      </p>
      <Button render={<Link href="/app" />} nativeButton={false}>
        {copy.notFound.cta}
      </Button>
    </div>
  );
}
