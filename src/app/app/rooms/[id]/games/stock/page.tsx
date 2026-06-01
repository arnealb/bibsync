import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStockQuote } from "@/app/_actions/stock";
import { StockPanel } from "@/components/stock/stock-panel";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { getStockHistory } from "@/lib/stock/queries";

interface StockPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: StockPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.stock.title} · ${access.room.name}`
      : copy.stock.title,
  };
}

export default async function StockPage({ params }: StockPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [quote, history] = await Promise.all([
    getStockQuote(),
    getStockHistory(),
  ]);
  if (!quote) notFound();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.stock.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.stock.subtitle}</p>
      </div>
      <StockPanel initialQuote={quote} initialHistory={history} />
    </div>
  );
}
