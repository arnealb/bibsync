import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WheelPanel } from "@/components/wheel/wheel-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface WheelPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: WheelPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.wheel.title} · ${access.room.name}` : copy.wheel.title,
  };
}

export default async function WheelPage({ params }: WheelPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const balance = await getBibcoins(access.userId);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.wheel.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.wheel.subtitle}</p>
      </div>
      <WheelPanel roomId={id} initialBalance={balance} />
    </div>
  );
}
