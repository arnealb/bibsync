import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VoetbalHub } from "@/components/voetbal/voetbal-hub";
import { getVoetbalHourEarned } from "@/app/_actions/voetbal";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface VoetbalPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: VoetbalPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.voetbal.title} · ${access.room.name}`
      : copy.voetbal.title,
  };
}

export default async function VoetbalPage({ params }: VoetbalPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const hourEarned = await getVoetbalHourEarned();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.voetbal.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.voetbal.hubSubtitle}
        </p>
      </div>
      <VoetbalHub roomId={id} initialHourEarned={hourEarned} />
    </div>
  );
}
