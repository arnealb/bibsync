import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CrashPanel } from "@/components/crash/crash-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface CrashPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CrashPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.crash.title} · ${access.room.name}`
      : copy.crash.title,
  };
}

export default async function CrashPage({ params }: CrashPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const balance = await getBibcoins(access.userId);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.crash.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.crash.subtitle}</p>
      </div>
      <CrashPanel roomId={id} initialBalance={balance} />
    </div>
  );
}
